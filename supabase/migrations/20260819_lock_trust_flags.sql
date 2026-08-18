-- =============================================================
-- JomCOD — Aug 19: Lock admin/trust flags against self-promotion
--
-- Fixes OPEN_ISSUES.md #1. The profiles UPDATE policy is
--   for update using (auth.uid() = id)
-- with no column restriction, so any signed-in user could run
--   update profiles set is_admin = true where id = auth.uid()
-- and immediately unlock every admin_* RPC. The same hole allowed
-- self-approving (is_approved = true) and un-suspending.
--
-- Fix (three layers):
--   1. Column-level REVOKE of INSERT/UPDATE on the three trust columns
--      for anon + authenticated. Admin RPCs are SECURITY DEFINER and run
--      as the table owner, so they are unaffected. Direct SQL-editor edits
--      (postgres) are unaffected too, so the one-time admin bootstrap in
--      the phase-3 header still works.
--   2. profiles_trust_guard() BEFORE UPDATE trigger — defense in depth,
--      survives any future re-grant. Non-admins may still de-escalate
--      (is_approved true → false, used by the switch-to-runner flow) but
--      can never RAISE a trust flag. Direct DB edits (auth.uid() is null)
--      are always allowed for bootstrapping.
--   3. set_role() SECURITY DEFINER RPC — the only client-visible path that
--      changes role + approval. Replaces the generic updateProfile() upsert
--      that used to write is_approved directly.
--
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- =============================================================

-- 1) No client role may insert/update the trust columns.
revoke insert (is_admin, is_approved, is_suspended) on public.profiles from anon, authenticated;
revoke update (is_admin, is_approved, is_suspended) on public.profiles from anon, authenticated;

-- 2) Trigger guard (defense in depth).
create or replace function public.profiles_trust_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_admin boolean;
begin
  -- Direct database edits (SQL editor / owner) are allowed for bootstrapping.
  if auth.uid() is null then
    return new;
  end if;

  -- Only admins may RAISE a trust flag; de-escalation is always fine.
  if new.is_admin is distinct from old.is_admin
     or new.is_suspended is distinct from old.is_suspended
     or (new.is_approved and not old.is_approved) then
    select exists (select 1 from public.profiles where id = auth.uid() and is_admin)
      into v_admin;
    if not coalesce(v_admin, false) then
      raise exception 'Only admins can change trust flags';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists profiles_trust_guard_trigger on public.profiles;
create trigger profiles_trust_guard_trigger
  before update on public.profiles
  for each row execute function public.profiles_trust_guard();

-- 3) Role switch RPC — the only client path that may change role/approval.
create or replace function public.set_role(p_role text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return false;
  end if;
  if p_role not in ('community', 'runner') then
    raise exception 'Invalid role';
  end if;

  -- Switching to runner is treated like a fresh signup: approval resets.
  insert into public.profiles (id, role, status, is_approved)
  values (v_user, p_role, 'offline', false)
  on conflict (id) do update
    set role = excluded.role,
        status = 'offline',
        is_approved = case when p_role = 'runner' then false else public.profiles.is_approved end;

  return true;
end $$;

revoke execute on function public.set_role(text) from public;
grant execute on function public.set_role(text) to authenticated;
