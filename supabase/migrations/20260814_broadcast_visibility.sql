-- =============================================================
-- JomCOD — Aug 14: Broadcast visibility + price-on-accept
--
-- Fixes:
--  1. Runners couldn't open a broadcast from their notification
--     ("Job not found") once it was claimed or expired, because the
--     "runners can read open broadcasts" policy only allowed
--     pending + unassigned jobs, and `jobs readable by participants`
--     didn't include broadcast notifiers.
--  2. The "Open requests from the community" board relied on that
--     policy; making it durable fixes the empty board.
--  3. New set_job_total() so a broadcast's price total can be written
--     after a runner claims it (both sides then see the same amount).
--
-- Safe to re-run.
-- =============================================================

-- 1) Runners can read ANY open broadcast (assigned to nobody) in ANY status,
--    so notification links resolve even after the broadcast is taken/expired.
drop policy if exists "runners can read open broadcasts" on public.jobs;
create policy "runners can read open broadcasts" on public.jobs
  for select using (auth.uid() is not null and runner_id is null);

-- 2) A user may read a job they were notified about (e.g. a broadcast that
--    another runner claimed) so the notification link always opens.
drop policy if exists "users can read jobs they were notified about" on public.jobs;
create policy "users can read jobs they were notified about" on public.jobs
  for select using (
    exists (
      select 1 from public.notifications n
      where n.user_id = auth.uid() and n.job_id = public.jobs.id
    )
  );

-- 3) set_job_total(): the assigned runner (or the requester) can write/refresh
--    the "Total: RM…" line on a job. Used to price a broadcast after claiming,
--    since broadcast pricing varies by runner.
create or replace function public.set_job_total(p_job_id uuid, p_total text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_runner uuid := auth.uid();
  v_requester uuid;
  v_assigned uuid;
  v_current text;
begin
  if v_runner is null then
    return false;
  end if;
  if p_total is null or p_total = '' then
    return false;
  end if;

  select requester_id, runner_id into v_requester, v_assigned
    from public.jobs where id = p_job_id;
  if not found then
    raise exception 'Job not found';
  end if;

  -- Only the assigned runner or the requester may set the total.
  if v_runner <> v_assigned and v_runner <> v_requester then
    raise exception 'Not part of this job';
  end if;

  select notes into v_current from public.jobs where id = p_job_id;

  -- Replace an existing Total line, or append one.
  if v_current ~* '^Total:' then
    update public.jobs
       set notes = regexp_replace(coalesce(v_current,''), '(?im)^Total:\s*.*$', 'Total: ' || p_total)
     where id = p_job_id;
  else
    update public.jobs
       set notes = coalesce(v_current,'') || E'\nTotal: ' || p_total
     where id = p_job_id;
  end if;
  return true;
end $$;

revoke execute on function public.set_job_total(uuid,text) from public;
grant execute on function public.set_job_total(uuid,text) to authenticated;
