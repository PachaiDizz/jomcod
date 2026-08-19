-- =============================================================
-- JomCOD — Aug 19: Lock runner setup until admin approval
--
-- A brand-new (or just-switched) runner must wait for admin approval
-- before touching their profile setup. The dashboard already shows a
-- lock screen, and this trigger enforces it in the database too: an
-- unapproved runner cannot change their services or schedule. Admins,
-- direct DB edits, and approved runners are unaffected.
--
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- =============================================================

create or replace function public.profiles_runner_setup_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Direct database edits (SQL editor / owner) are allowed.
  if auth.uid() is null then
    return new;
  end if;

  -- Only unapproved runners are restricted, and admins are always allowed
  -- (admin RPCs run as definer but still carry the admin's uid).
  if (new.services is distinct from old.services
      or new.schedule_from is distinct from old.schedule_from
      or new.schedule_to is distinct from old.schedule_to)
     and new.role = 'runner'
     and not new.is_approved
     and not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Your runner profile is awaiting approval';
  end if;

  return new;
end $$;

drop trigger if exists profiles_runner_setup_guard_trigger on public.profiles;
create trigger profiles_runner_setup_guard_trigger
  before update on public.profiles
  for each row execute function public.profiles_runner_setup_guard();
