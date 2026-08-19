-- =============================================================
-- JomCOD — Aug 19: Broadcast open-board privacy fix
--
-- Fixes OPEN_ISSUES.md #3. The "runners can read open broadcasts"
-- policy filters unassigned jobs but has NO status filter, so any
-- approved runner could read every historical cancelled/expired
-- broadcast — including the community's pickup + delivery addresses.
--
-- Fix: restore status = 'pending' so only genuinely open broadcasts
-- are readable from the board. Claimed broadcasts stay readable only
-- by their participants (requester + assigned runner); expired and
-- cancelled broadcasts are no longer readable by runners at all.
--
-- Deliberate tradeoff: a runner tapping an OLD "New broadcast request"
-- notification for a broadcast that has since expired/been claimed will
-- now hit the job "not found" page. That matches the Aug 14 notification
-- privacy fix (notification links never leak private job details), and
-- the Open-requests board + active broadcast links keep resolving.
--
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- =============================================================

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
    and status = 'pending'
  );
