-- =============================================================
-- JomCOD — Phase 1 (Security) + Phase 2 (Core Reliability)
--
-- Run this ONCE in the Supabase SQL editor. End the script with
-- --done (see PROJECT.md for why). Safe to re-run.
-- =============================================================

-- =============================================================
-- 0. Schema additions
-- =============================================================

-- Availability freshness (Phase 2 — stale "available" prevention).
alter table public.profiles add column if not exists last_seen_at timestamptz default now();
alter table public.profiles add column if not exists availability_updated_at timestamptz;

-- Job lifecycle timestamps + new 'cancelled' state.
alter table public.jobs add column if not exists cancelled_at timestamptz;
alter table public.jobs add column if not exists completed_at timestamptz;

alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs add constraint jobs_status_check
  check (status in ('pending','confirmed','done','expired','cancelled'));

-- =============================================================
-- 1. profiles RLS — public vs private (Phase 1)
-- =============================================================
-- Public discovery now happens through runner_profiles_public below.
-- The profiles table itself is only readable by its owner, so sensitive
-- fields (whatsapp, home address) are never exposed to public browsers.

drop policy if exists "profiles are viewable by everyone" on public.profiles;
create policy "users can view their own profile" on public.profiles
  for select using (auth.uid() = id);

-- Public view: only discovery fields + a live completed-jobs count.
-- Views run with the owner's (postgres) privileges, so they bypass RLS
-- in a controlled way — exactly like a security definer function.
create or replace view public.runner_profiles_public as
select
  p.id,
  p.username,
  p.full_name,
  p.role,
  p.status,
  p.area,
  p.services,
  p.schedule_from,
  p.schedule_to,
  p.last_seen_at,
  p.created_at,
  (select count(*) from public.jobs j where j.runner_id = p.id and j.status = 'done') as jobs_completed
from public.profiles p;

grant select on public.runner_profiles_public to anon, authenticated;

-- =============================================================
-- 2. jobs RLS — SELECT only; state changes go through functions
-- =============================================================
-- No more direct INSERT / UPDATE on jobs. All creation + transitions
-- run server-side so business rules and sensitive fields are enforced
-- in the database, not only in the frontend.

drop policy if exists "users can create jobs" on public.jobs;
drop policy if exists "participants can update jobs" on public.jobs;

-- =============================================================
-- 3. reviews RLS — inserts/updates move to add_review()
-- =============================================================
drop policy if exists "reviewers can add their own review" on public.reviews;
drop policy if exists "reviewers can update their own review" on public.reviews;

-- =============================================================
-- 4. Server-side job state machine (Phase 2)
-- =============================================================

-- Guard trigger (defense-in-depth): rejects invalid transitions and
-- ownership edits even if someone bypasses the app.
create or replace function public.jobs_guard_status()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if old.requester_id is distinct from new.requester_id then
      raise exception 'Requester of a job cannot be changed';
    end if;
    if old.runner_id is not null and old.runner_id is distinct from new.runner_id then
      raise exception 'Runner of a job cannot be changed';
    end if;
    if old.status is distinct from new.status and not (
        (old.status = 'pending'  and new.status in ('confirmed','cancelled','expired'))
     or (old.status = 'confirmed' and new.status in ('done','cancelled'))
     or (old.status = 'done'      and new.status = 'done')
    ) then
      raise exception 'Invalid job status transition: % -> %', old.status, new.status;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists jobs_status_guard on public.jobs;
create trigger jobs_status_guard
  before update on public.jobs
  for each row execute function public.jobs_guard_status();

-- create_request(): the ONLY way to create a job. Includes spam,
-- duplicate and self-request guards.
create or replace function public.create_request(
  p_service_type text,
  p_take_from text,
  p_deliver_to text,
  p_notes text default '',
  p_runner_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_requester uuid := auth.uid();
  v_new_id uuid := gen_random_uuid();
  v_active int;
begin
  if v_requester is null then
    raise exception 'You must be signed in to request a service';
  end if;
  if nullif(p_service_type,'') is null then
    raise exception 'Service type is required';
  end if;
  if nullif(p_take_from,'') is null then
    raise exception 'Pickup details are required';
  end if;
  if nullif(p_deliver_to,'') is null then
    raise exception 'Delivery details are required';
  end if;
  if p_runner_id is not null and p_runner_id = v_requester then
    raise exception 'You cannot request your own service';
  end if;

  -- Spam guard: max active (pending or confirmed) requests per user.
  select count(*) into v_active from public.jobs
    where requester_id = v_requester
      and status in ('pending','confirmed');
  if v_active >= 5 then
    raise exception 'You have too many active requests — finish or cancel one first';
  end if;

  if p_runner_id is not null then
    -- Duplicate direct request to the same runner + service.
    if exists (
      select 1 from public.jobs
      where requester_id = v_requester
        and runner_id = p_runner_id
        and service_type = p_service_type
        and status = 'pending'
    ) then
      raise exception 'You already have a pending request with this runner for that service';
    end if;
  else
    -- One active broadcast at a time.
    if exists (
      select 1 from public.jobs
      where requester_id = v_requester
        and runner_id is null
        and status = 'pending'
    ) then
      raise exception 'You already have an active broadcast — wait for it to expire or cancel it first';
    end if;
  end if;

  insert into public.jobs
    (id, requester_id, runner_id, service_type, take_from, deliver_to, notes, status)
  values
    (v_new_id, v_requester, p_runner_id, p_service_type, p_take_from, p_deliver_to, p_notes, 'pending');

  return v_new_id;
end $$;

revoke execute on function public.create_request(text,text,text,text,uuid) from public;
grant execute on function public.create_request(text,text,text,text,uuid) to authenticated;

-- accept_job(): runner accepts a direct request assigned to them.
create or replace function public.accept_job(p_job_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_runner uuid := auth.uid();
  v_role text;
begin
  if v_runner is null then
    return false;
  end if;

  select role into v_role from public.profiles where id = v_runner;
  if v_role is distinct from 'runner' then
    raise exception 'Only runners can accept requests';
  end if;

  -- A runner can only handle one active job at a time.
  if exists (
    select 1 from public.jobs
    where runner_id = v_runner and status = 'confirmed' and id <> p_job_id
  ) then
    raise exception 'You already have an active job — finish it before accepting another';
  end if;

  update public.jobs
     set status = 'confirmed'
   where id = p_job_id
     and runner_id = v_runner
     and status = 'pending';

  return found;
end $$;

revoke execute on function public.accept_job(uuid) from public;
grant execute on function public.accept_job(uuid) to authenticated;

-- decline_job(): runner declines a direct request -> cancelled.
create or replace function public.decline_job(p_job_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_runner uuid := auth.uid();
begin
  if v_runner is null then
    return false;
  end if;

  update public.jobs
     set status = 'cancelled',
         cancelled_at = now()
   where id = p_job_id
     and runner_id = v_runner
     and status = 'pending';

  return found;
end $$;

revoke execute on function public.decline_job(uuid) from public;
grant execute on function public.decline_job(uuid) to authenticated;

-- mark_job_done(): runner completes the job.
create or replace function public.mark_job_done(p_job_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_runner uuid := auth.uid();
begin
  if v_runner is null then
    return false;
  end if;

  update public.jobs
     set status = 'done',
         completed_at = now()
   where id = p_job_id
     and runner_id = v_runner
     and status = 'confirmed';

  return found;
end $$;

revoke execute on function public.mark_job_done(uuid) from public;
grant execute on function public.mark_job_done(uuid) to authenticated;

-- cancel_job(): community cancels their pending/confirmed request.
create or replace function public.cancel_job(p_job_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_requester uuid := auth.uid();
begin
  if v_requester is null then
    return false;
  end if;

  update public.jobs
     set status = 'cancelled',
         cancelled_at = now()
   where id = p_job_id
     and requester_id = v_requester
     and status in ('pending','confirmed');

  return found;
end $$;

revoke execute on function public.cancel_job(uuid) from public;
grant execute on function public.cancel_job(uuid) to authenticated;

-- claim_broadcast(): audited first-to-accept (atomic). Only valid runners,
-- not their own broadcast, not stale/expired jobs, one active job max.
create or replace function public.claim_broadcast(p_job_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_runner uuid := auth.uid();
  v_role text;
begin
  if v_runner is null then
    return false;
  end if;

  select role into v_role from public.profiles where id = v_runner;
  if v_role is distinct from 'runner' then
    raise exception 'Only runners can claim broadcasts';
  end if;

  if exists (
    select 1 from public.jobs
    where runner_id = v_runner and status = 'confirmed' and id <> p_job_id
  ) then
    raise exception 'You already have an active job — finish it before claiming another';
  end if;

  -- Atomic: only one UPDATE matches, so only one runner wins.
  update public.jobs
     set runner_id = v_runner,
         status = 'confirmed'
   where id = p_job_id
     and runner_id is null
     and status = 'pending'
     and requester_id <> v_runner
     and created_at > now() - interval '5 minutes';

  return found;
end $$;

revoke execute on function public.claim_broadcast(uuid) from public;
grant execute on function public.claim_broadcast(uuid) to authenticated;

-- =============================================================
-- 5. Automatic job expiry (Phase 2) — server-side, no more client-only
-- =============================================================

create or replace function public.expire_stale_jobs()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  update public.jobs
     set status = 'expired'
   where status = 'pending'
     and created_at < now() - interval '5 minutes';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function public.expire_stale_jobs() from public;
grant execute on function public.expire_stale_jobs() to authenticated;

-- Run every minute via Supabase pg_cron (skipped if cron is not enabled).
do $$
begin
  if to_regnamespace('cron') is not null then
    perform cron.schedule('jomcod-expire-jobs', '*/1 * * * *', $job$select public.expire_stale_jobs()$job$);
  end if;
end $$;

-- =============================================================
-- 6. Runner availability freshness (Phase 2)
-- =============================================================

-- Heartbeat: the runner's open dashboard pings this while they're online.
create or replace function public.touch_availability()
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_runner uuid := auth.uid();
begin
  if v_runner is null then
    return false;
  end if;
  update public.profiles set last_seen_at = now() where id = v_runner;
  return true;
end $$;

revoke execute on function public.touch_availability() from public;
grant execute on function public.touch_availability() to authenticated;

-- Status changes always stamp freshness timestamps.
create or replace function public.set_availability(p_status text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_runner uuid := auth.uid();
begin
  if v_runner is null then
    return false;
  end if;
  if p_status not in ('available','busy','delivery','offline') then
    raise exception 'Invalid availability status';
  end if;
  update public.profiles
     set status = p_status,
         last_seen_at = now(),
         availability_updated_at = now()
   where id = v_runner;
  return true;
end $$;

revoke execute on function public.set_availability(text) from public;
grant execute on function public.set_availability(text) to authenticated;

-- Auto-offline stale "available" runners whose heartbeat expired.
create or replace function public.refresh_availability()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  update public.profiles
     set status = 'offline',
         availability_updated_at = now()
   where role = 'runner'
     and status = 'available'
     and last_seen_at < now() - interval '5 minutes';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function public.refresh_availability() from public;
grant execute on function public.refresh_availability() to authenticated;

do $$
begin
  if to_regnamespace('cron') is not null then
    perform cron.schedule('jomcod-refresh-availability', '*/1 * * * *', $job$select public.refresh_availability()$job$);
  end if;
end $$;

-- =============================================================
-- 7. WhatsApp privacy (Phase 1) — contact gated by relationship
-- =============================================================
-- A user's WhatsApp is shared only with someone they share an accepted /
-- completed job with. The requester unlocks the runner's number after the
-- runner accepts; an assigned runner can reach the requester immediately.
create or replace function public.get_user_contact(p_user_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_name text;
  v_wa text;
begin
  if v_caller is null then
    return null;
  end if;

  if v_caller = p_user_id then
    select coalesce(username, full_name, 'You'), coalesce(whatsapp, '')
      into v_name, v_wa from public.profiles where id = p_user_id;
    return json_build_object('name', v_name, 'whatsapp', v_wa);
  end if;

  -- Community sees the runner's number once the runner has accepted.
  if exists (
    select 1 from public.jobs
    where status in ('confirmed','done')
      and requester_id = v_caller
      and runner_id = p_user_id
  ) then
    select coalesce(username, full_name, 'Runner'), coalesce(whatsapp, '')
      into v_name, v_wa from public.profiles where id = p_user_id;
    return json_build_object('name', v_name, 'whatsapp', v_wa);
  end if;

  -- A runner assigned to the requester can reach them straight away.
  if exists (
    select 1 from public.jobs
    where status in ('pending','confirmed','done')
      and requester_id = p_user_id
      and runner_id = v_caller
  ) then
    select coalesce(username, full_name, 'Runner'), coalesce(whatsapp, '')
      into v_name, v_wa from public.profiles where id = p_user_id;
    return json_build_object('name', v_name, 'whatsapp', v_wa);
  end if;

  -- Otherwise: name only, no contact.
  select coalesce(username, full_name, 'Runner'), ''
    into v_name, v_wa from public.profiles where id = p_user_id;
  return json_build_object('name', v_name, 'whatsapp', '');
end $$;

revoke execute on function public.get_user_contact(uuid) from public;
grant execute on function public.get_user_contact(uuid) to authenticated;

-- =============================================================
-- 8. Reviews — must be tied to a genuine completed job (Phase 1/2)
-- =============================================================

create or replace function public.add_review(p_job_id uuid, p_rating int, p_text text default '')
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_reviewer uuid := auth.uid();
  v_job record;
begin
  if v_reviewer is null then
    return false;
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  select * into v_job from public.jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.status <> 'done' then
    raise exception 'Only completed jobs can be rated';
  end if;
  if v_job.requester_id <> v_reviewer then
    raise exception 'Only the person who requested this job can rate it';
  end if;
  if v_job.runner_id is null then
    raise exception 'This job has no runner to rate';
  end if;

  insert into public.reviews (job_id, runner_id, reviewer_id, author_name, rating, text)
  values (p_job_id, v_job.runner_id, v_reviewer,
    coalesce((select username from public.profiles where id = v_reviewer), 'Community member'),
    p_rating, coalesce(p_text,''));
  return true;
exception
  when unique_violation then
    raise exception 'You already rated this job';
end $$;

revoke execute on function public.add_review(uuid,int,text) from public;
grant execute on function public.add_review(uuid,int,text) to authenticated;

-- =============================================================
-- 9. Landing stats — refresh stale availability first, exclude cancelled
-- =============================================================

create or replace function public.get_landing_stats()
returns json language plpgsql security definer set search_path = public as $$
declare
  v_total int;
  v_available int;
  v_busy int;
  v_off int;
  v_jobs_month int;
  v_avg numeric;
begin
  perform public.refresh_availability();

  select count(*) into v_total from public.profiles where role = 'runner';
  select count(*) into v_available from public.profiles where role = 'runner' and status = 'available';
  select count(*) into v_busy from public.profiles where role = 'runner' and status in ('busy','delivery');
  select count(*) into v_off from public.profiles where role = 'runner' and status = 'offline';
  select count(*) into v_jobs_month from public.jobs
    where created_at >= date_trunc('month', now())
      and created_at < date_trunc('month', now()) + interval '1 month'
      and status in ('pending','confirmed','done','expired');
  select round(avg(rating), 1) into v_avg from public.reviews;
  return json_build_object(
    'active_runners', v_total - v_off,
    'available', v_available,
    'busy', v_busy,
    'off', v_off,
    'jobs_this_month', v_jobs_month,
    'avg_rating', coalesce(v_avg, 0)
  );
end $$;

grant execute on function public.get_landing_stats() to anon, authenticated;

-- =============================================================
-- 10. Indexes for the query patterns we actually use (Phase 2)
-- =============================================================

create index if not exists jobs_requester_id_idx on public.jobs (requester_id);
create index if not exists jobs_runner_id_idx on public.jobs (runner_id);
create index if not exists jobs_status_idx on public.jobs (status);
create index if not exists jobs_created_at_idx on public.jobs (created_at);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_status_idx on public.profiles (status);
create index if not exists profiles_area_idx on public.profiles (area);
create index if not exists profiles_last_seen_at_idx on public.profiles (last_seen_at);
create index if not exists reviews_runner_id_idx on public.reviews (runner_id); --done
