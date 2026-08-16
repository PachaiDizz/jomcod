-- =============================================================
-- JomCOD — Full data reset (keep admins)
--
-- Wipes every user-generated row for a fresh public launch, while
-- KEEPING all admin profiles (is_admin = true) and the push secret.
--
-- ⚠️ DESTRUCTIVE — deletes profiles, jobs, reviews, notifications,
--    reports, blocks, and push subscriptions for non-admins.
--    Run ONCE in the Supabase SQL editor. NOT safe to re-run.
-- =============================================================

begin;

-- 1) Derived / dependent rows first (FK-safe order).
delete from public.notifications;
delete from public.reports;
delete from public.blocks;
delete from public.push_subscriptions;
delete from public.reviews;

-- 2) Jobs (cascades remaining notifications/reviews via job_id).
delete from public.jobs;

-- 3) Non-admin profiles.
delete from public.profiles
where is_admin is not true;

-- 4) Non-admin auth accounts. Supabase auth keeps its own tables
--    (identities, sessions, etc.) — removing the user cascades those.
delete from auth.users u
where not exists (
  select 1 from public.profiles p
  where p.id = u.id and p.is_admin is true
);

commit;
