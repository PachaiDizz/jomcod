-- =============================================================
-- JomCOD — Aug 14: Notification privacy + broadcast visibility fixes
--
-- Fixes:
--  1. Broadcasts were readable by ANY logged-in user ("runners can
--     read open broadcasts" only checked runner_id is null). Now only
--     approved, non-suspended runners can read open broadcasts.
--  2. "users can read jobs they were notified about" leaked the FULL
--     job row (delivery address, receiver, notes incl. "Total: RM…")
--     to every runner who ever saw a broadcast, even after another
--     runner claimed it. Dropped. Claimed/private jobs are only
--     readable by participants again.
--  3. jobs_notify(): when a broadcast is claimed, other runners' stale
--     "New broadcast request" notifications are removed and replaced
--     with a single "Request already taken" notice — no job details,
--     no total, no receiver info, no link to the private job.
--  4. new_broadcast notification bodies no longer embed the delivery
--     destination (receiver + address). Just the service + pickup.
--
-- Safe to re-run.
-- =============================================================

-- 1) Open broadcasts: only approved, non-suspended runners may read.
drop policy if exists "runners can read open broadcasts" on public.jobs;
create policy "runners can read open broadcasts" on public.jobs
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'runner'
        and p.is_approved
        and not p.is_suspended
    )
    and runner_id is null
  );

-- 2) Remove the leaky "notified about" read policy — participants +
--    (for open broadcasts) runners are the only readers now.
drop policy if exists "users can read jobs they were notified about" on public.jobs;

-- 3) Rewrite the notification trigger.
create or replace function public.jobs_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.runner_id is not null then
      insert into public.notifications (user_id, kind, title, body, job_id)
      values (new.runner_id, 'new_request', 'New request',
        new.service_type || ' · ' || new.take_from || ' → ' || new.deliver_to, new.id);
    else
      -- Broadcast → only approved runners. Body carries just the service +
      -- pickup (no receiver / delivery address / private details).
      insert into public.notifications (user_id, kind, title, body, job_id)
      select id, 'new_broadcast', 'New broadcast request',
        new.service_type || ' · ' || new.take_from, new.id
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

      if old.runner_id is null then
        -- A broadcast was claimed. Every other runner who saw it loses the
        -- stale "New broadcast request" notification and gets a bare
        -- "already taken" notice instead (no job link, no private details).
        insert into public.notifications (user_id, kind, title, body, job_id)
        select user_id, 'broadcast_taken', 'Request already taken',
               'This request has already been accepted by another runner.', null
        from public.notifications
        where job_id = new.id and kind = 'new_broadcast' and user_id <> new.runner_id;

        delete from public.notifications
        where job_id = new.id and kind = 'new_broadcast' and user_id <> new.runner_id;
      end if;
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

-- 4) Clean up notifications already leaked by the old behaviour: remove
--    "New broadcast request" notifications for broadcasts that have since
--    been claimed by someone else. (The winning runner keeps theirs.)
delete from public.notifications n
using public.jobs j
where n.job_id = j.id
  and n.kind = 'new_broadcast'
  and j.runner_id is not null
  and j.runner_id <> n.user_id;
