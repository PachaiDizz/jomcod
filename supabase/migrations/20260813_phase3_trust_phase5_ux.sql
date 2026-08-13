-- =============================================================
-- JomCOD — Phase 3 (Trust) + Phase 5 (UX)
--
-- Run this ONCE in the Supabase SQL editor. End with --done.
-- Safe to re-run.
--
-- AFTER running, make yourself an admin by running this once:
--   update public.profiles set is_admin = true
--   where id = '<YOUR_USER_ID>';
-- (The Admin page shows your own user id + this hint if you open
--  /admin before promoting yourself.)
-- =============================================================

-- =============================================================
-- 1. Schema additions
-- =============================================================

-- Trust flags on profiles.
alter table public.profiles add column if not exists is_approved boolean not null default false;
alter table public.profiles add column if not exists is_suspended boolean not null default false;
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- Grandfather existing runners: current runners stay approved.
update public.profiles set is_approved = true where role = 'runner' and not is_approved;

-- Track who cancelled a job so notifications can tell the other party.
alter table public.jobs add column if not exists cancelled_by uuid;

-- User reports (Phase 3).
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  reported_id uuid references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  reason text not null,
  details text default '',
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz default now()
);

-- Blocks (Phase 3) — you never see / can't request someone you blocked.
create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid references auth.users(id) on delete cascade,
  blocked_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (blocker_id, blocked_id)
);

-- Notifications hub (Phase 5) — durable history of important events.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null default 'info',
  title text not null,
  body text default '',
  job_id uuid references public.jobs(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz default now()
);

-- RLS — reports: people read their own, admins read via functions.
alter table public.reports enable row level security;
drop policy if exists "reporters can insert reports" on public.reports;
drop policy if exists "reporters can read their own reports" on public.reports;
create policy "reporters can insert reports" on public.reports
  for insert with check (auth.uid() = reporter_id);
create policy "reporters can read their own reports" on public.reports
  for select using (auth.uid() = reporter_id);

-- RLS — blocks: people manage their own block list.
alter table public.blocks enable row level security;
drop policy if exists "users manage their own blocks" on public.blocks;
create policy "users manage their own blocks" on public.blocks
  for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

-- RLS — notifications: read + mark read, own rows only. Inserts happen
-- only through the security-definer trigger.
alter table public.notifications enable row level security;
drop policy if exists "users read their notifications" on public.notifications;
drop policy if exists "users update their notifications" on public.notifications;
create policy "users read their notifications" on public.notifications
  for select using (auth.uid() = user_id);
create policy "users update their notifications" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Expose trust flags through the public view so Browse can filter.
drop view if exists public.runner_profiles_public;
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
  p.is_approved,
  p.is_suspended,
  (select count(*) from public.jobs j where j.runner_id = p.id and j.status = 'done') as jobs_completed
from public.profiles p;

grant select on public.runner_profiles_public to anon, authenticated;

-- =============================================================
-- 2. Trust enforcement in existing functions
-- =============================================================

-- create_request(): also rejects suspended users and blocked relationships.
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
  if exists (select 1 from public.profiles where id = v_requester and is_suspended) then
    raise exception 'Your account is suspended. Contact support for help.';
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
  if p_runner_id is not null and exists (
    select 1 from public.blocks
    where (blocker_id = v_requester and blocked_id = p_runner_id)
       or (blocker_id = p_runner_id and blocked_id = v_requester)
  ) then
    raise exception 'You cannot request this runner right now';
  end if;

  select count(*) into v_active from public.jobs
    where requester_id = v_requester
      and status in ('pending','confirmed');
  if v_active >= 5 then
    raise exception 'You have too many active requests — finish or cancel one first';
  end if;

  if p_runner_id is not null then
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

-- accept_job(): require an approved, non-suspended runner.
create or replace function public.accept_job(p_job_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_runner uuid := auth.uid();
  v_role text;
  v_approved boolean;
  v_suspended boolean;
begin
  if v_runner is null then
    return false;
  end if;

  select role, is_approved, is_suspended into v_role, v_approved, v_suspended
    from public.profiles where id = v_runner;
  if v_role is distinct from 'runner' then
    raise exception 'Only runners can accept requests';
  end if;
  if not v_approved then
    raise exception 'Your runner profile is awaiting approval';
  end if;
  if v_suspended then
    raise exception 'Your account is suspended';
  end if;

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

-- decline_job(): records who cancelled so notifications reach the requester.
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
         cancelled_at = now(),
         cancelled_by = v_runner
   where id = p_job_id
     and runner_id = v_runner
     and status = 'pending';

  return found;
end $$;

revoke execute on function public.decline_job(uuid) from public;
grant execute on function public.decline_job(uuid) to authenticated;

-- cancel_job(): records who cancelled so notifications reach the runner.
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
         cancelled_at = now(),
         cancelled_by = v_requester
   where id = p_job_id
     and requester_id = v_requester
     and status in ('pending','confirmed');

  return found;
end $$;

revoke execute on function public.cancel_job(uuid) from public;
grant execute on function public.cancel_job(uuid) to authenticated;

-- claim_broadcast(): require an approved, non-suspended runner.
create or replace function public.claim_broadcast(p_job_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_runner uuid := auth.uid();
  v_role text;
  v_approved boolean;
  v_suspended boolean;
begin
  if v_runner is null then
    return false;
  end if;

  select role, is_approved, is_suspended into v_role, v_approved, v_suspended
    from public.profiles where id = v_runner;
  if v_role is distinct from 'runner' then
    raise exception 'Only runners can claim broadcasts';
  end if;
  if not v_approved then
    raise exception 'Your runner profile is awaiting approval';
  end if;
  if v_suspended then
    raise exception 'Your account is suspended';
  end if;

  if exists (
    select 1 from public.jobs
    where runner_id = v_runner and status = 'confirmed' and id <> p_job_id
  ) then
    raise exception 'You already have an active job — finish it before claiming another';
  end if;

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

-- set_availability(): unapproved runners can't go "available".
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
  if p_status = 'available' and not exists (
    select 1 from public.profiles where id = v_runner and is_approved and not is_suspended
  ) then
    raise exception 'Your runner profile is awaiting approval';
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

-- get_landing_stats(): only count approved, non-suspended runners.
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

  select count(*) into v_total from public.profiles
    where role = 'runner' and is_approved and not is_suspended;
  select count(*) into v_available from public.profiles
    where role = 'runner' and is_approved and not is_suspended and status = 'available';
  select count(*) into v_busy from public.profiles
    where role = 'runner' and is_approved and not is_suspended and status in ('busy','delivery');
  select count(*) into v_off from public.profiles
    where role = 'runner' and is_approved and not is_suspended and status = 'offline';
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
-- 3. Reports — submit_report()
-- =============================================================

create or replace function public.submit_report(
  p_reported_id uuid,
  p_reason text,
  p_details text default '',
  p_job_id uuid default null
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_reporter uuid := auth.uid();
  v_open int;
begin
  if v_reporter is null then
    return false;
  end if;
  if p_reported_id is null or p_reported_id = v_reporter then
    raise exception 'You cannot report yourself';
  end if;
  if exists (select 1 from public.profiles where id = v_reporter and is_suspended) then
    raise exception 'Your account is suspended';
  end if;
  if nullif(p_reason,'') is null then
    raise exception 'Please choose a reason';
  end if;
  if length(coalesce(p_details,'')) > 2000 then
    raise exception 'Details are too long';
  end if;

  -- Spam guard: max 5 open reports per user.
  select count(*) into v_open from public.reports
    where reporter_id = v_reporter and status = 'open';
  if v_open >= 5 then
    raise exception 'You have too many open reports — wait for them to be reviewed';
  end if;

  insert into public.reports (reporter_id, reported_id, job_id, reason, details)
  values (v_reporter, p_reported_id, p_job_id, p_reason, p_details);
  return true;
end $$;

revoke execute on function public.submit_report(uuid,text,text,uuid) from public;
grant execute on function public.submit_report(uuid,text,text,uuid) to authenticated;

-- =============================================================
-- 4. Notifications — generated from job lifecycle (Phase 5)
-- =============================================================

create or replace function public.jobs_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.runner_id is not null then
      insert into public.notifications (user_id, kind, title, body, job_id)
      values (new.runner_id, 'new_request', 'New request',
        new.service_type || ' · ' || new.take_from || ' → ' || new.deliver_to, new.id);
    else
      insert into public.notifications (user_id, kind, title, body, job_id)
      select id, 'new_broadcast', 'New broadcast request',
        new.service_type || ' · ' || new.take_from || ' → ' || new.deliver_to, new.id
      from public.profiles
      where role = 'runner' and is_approved and not is_suspended and id <> new.requester_id;
    end if;
    return new;
  end if;

  if old.status is distinct from new.status then
    if new.status = 'confirmed' and old.status = 'pending' then
      insert into public.notifications (user_id, kind, title, body, job_id)
      values (new.requester_id, 'accepted', 'Runner accepted your request',
        new.service_type, new.id);
    elsif new.status = 'done' and old.status = 'confirmed' then
      insert into public.notifications (user_id, kind, title, body, job_id)
      values (new.requester_id, 'done', 'Request completed', new.service_type, new.id);
    elsif new.status = 'expired' and old.status = 'pending' then
      insert into public.notifications (user_id, kind, title, body, job_id)
      values (new.requester_id, 'expired', 'Your request expired', new.service_type, new.id);
    elsif new.status = 'cancelled' and old.status in ('pending','confirmed') then
      if new.cancelled_by = new.requester_id then
        insert into public.notifications (user_id, kind, title, body, job_id)
        values (new.runner_id, 'cancelled', 'Request cancelled', new.service_type, new.id);
      else
        insert into public.notifications (user_id, kind, title, body, job_id)
        values (new.requester_id, 'declined', 'Runner declined your request', new.service_type, new.id);
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists jobs_notify_trigger on public.jobs;
create trigger jobs_notify_trigger
  after insert or update on public.jobs
  for each row execute function public.jobs_notify();

-- =============================================================
-- 5. Admin functions (Phase 3)
-- =============================================================

create or replace function public.admin_list_runners()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_data jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Admin access required';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'name', coalesce(username, full_name, 'Runner'),
      'area', area,
      'status', status,
      'is_approved', is_approved,
      'is_suspended', is_suspended,
      'created_at', created_at)
    order by created_at desc), '[]'::jsonb)
  into v_data from public.profiles where role = 'runner';
  return v_data;
end $$;

revoke execute on function public.admin_list_runners() from public;
grant execute on function public.admin_list_runners() to authenticated;

create or replace function public.admin_list_jobs()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_data jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Admin access required';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'service_type', service_type,
      'status', status,
      'take_from', take_from,
      'deliver_to', deliver_to,
      'requester_id', requester_id,
      'runner_id', runner_id,
      'created_at', created_at)
    order by created_at desc), '[]'::jsonb)
  into v_data from (select * from public.jobs order by created_at desc limit 100) j;
  return v_data;
end $$;

revoke execute on function public.admin_list_jobs() from public;
grant execute on function public.admin_list_jobs() to authenticated;

create or replace function public.admin_list_reports()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_data jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Admin access required';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id,
      'reason', r.reason,
      'details', r.details,
      'status', r.status,
      'created_at', r.created_at,
      'reporter_name', coalesce(p1.username, p1.full_name, 'Unknown'),
      'reported_name', coalesce(p2.username, p2.full_name, 'Unknown'),
      'reported_id', r.reported_id)
    order by r.created_at desc), '[]'::jsonb)
  into v_data
  from public.reports r
  left join public.profiles p1 on p1.id = r.reporter_id
  left join public.profiles p2 on p2.id = r.reported_id;
  return v_data;
end $$;

revoke execute on function public.admin_list_reports() from public;
grant execute on function public.admin_list_reports() to authenticated;

create or replace function public.admin_set_approved(p_user_id uuid, p_approved boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Admin access required';
  end if;
  update public.profiles set is_approved = p_approved where id = p_user_id;
  return found;
end $$;

revoke execute on function public.admin_set_approved(uuid,boolean) from public;
grant execute on function public.admin_set_approved(uuid,boolean) to authenticated;

create or replace function public.admin_set_suspended(p_user_id uuid, p_suspended boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Admin access required';
  end if;
  update public.profiles set is_suspended = p_suspended where id = p_user_id;
  return found;
end $$;

revoke execute on function public.admin_set_suspended(uuid,boolean) from public;
grant execute on function public.admin_set_suspended(uuid,boolean) to authenticated;

create or replace function public.admin_set_report_status(p_report_id uuid, p_status text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Admin access required';
  end if;
  if p_status not in ('open','resolved','dismissed') then
    raise exception 'Invalid report status';
  end if;
  update public.reports set status = p_status where id = p_report_id;
  return found;
end $$;

revoke execute on function public.admin_set_report_status(uuid,text) from public;
grant execute on function public.admin_set_report_status(uuid,text) to authenticated;

-- =============================================================
-- 6. Indexes
-- =============================================================

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists blocks_blocker_idx on public.blocks (blocker_id);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);
create index if not exists reports_status_idx on public.reports (status);
create index if not exists reports_reported_idx on public.reports (reported_id);
create index if not exists profiles_approved_idx on public.profiles (is_approved);
create index if not exists profiles_suspended_idx on public.profiles (is_suspended); --done
