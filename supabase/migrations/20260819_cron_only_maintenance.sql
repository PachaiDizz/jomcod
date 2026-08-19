-- =============================================================
-- JomCOD — Aug 19: Maintenance jobs are pg_cron-only
-- (no more client/anon-triggered DB writes)
--
-- Fixes OPEN_ISSUES.md #5. Two write-amplification vectors:
--   1. get_landing_stats() (granted to anon) called refresh_availability(),
--      so EVERY anonymous landing visitor caused an UPDATE on profiles.
--   2. refresh_availability() and expire_stale_jobs() were granted to
--      authenticated and called on every dashboard / browse load.
--
-- Fix:
--   1. get_landing_stats() no longer refreshes — it is read-only now
--      (up to ~1 minute stale, since the cron tick keeps it fresh).
--   2. refresh_availability() and expire_stale_jobs() are revoked from
--      anon + authenticated. They run ONLY from pg_cron (every minute,
--      re-asserted below).
--
-- NOTE: pg_cron must be enabled in your Supabase project for expiry and
-- stale-availability to keep running (Dashboard → Database → Extensions).
--
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- =============================================================

-- 1) get_landing_stats(): read-only — no refresh-on-landing.
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

-- 2) Maintenance functions: only pg_cron may call them now.
revoke execute on function public.refresh_availability() from anon, authenticated;
revoke execute on function public.expire_stale_jobs() from anon, authenticated;

-- 3) Re-assert the minute cron jobs (idempotent — safe even if they already
--    exist; skipped gracefully when pg_cron isn't enabled).
do $$
begin
  if to_regnamespace('cron') is not null then
    perform cron.schedule('jomcod-expire-jobs', '*/1 * * * *', $job$select public.expire_stale_jobs()$job$);
    perform cron.schedule('jomcod-refresh-availability', '*/1 * * * *', $job$select public.refresh_availability()$job$);
  end if;
end $$;
