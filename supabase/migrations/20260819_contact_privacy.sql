-- =============================================================
-- JomCOD — Aug 19: get_user_contact() no longer leaks names
--
-- Fixes OPEN_ISSUES.md #12. The fallback branch returned the target's
-- NAME to any signed-in caller even with no shared job — so anyone
-- could look up the real name of a community member (or runner) who
-- had no job relationship with them.
--
-- Fix: with no shared job, return NULL (no name, no whatsapp). The
-- client already treats a NULL result as "unknown contact" and falls
-- back to a generic label, so nothing breaks.
--
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- =============================================================

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

  -- No shared job: no name, no contact (previously leaked the name).
  return null;
end $$;

revoke execute on function public.get_user_contact(uuid) from public;
grant execute on function public.get_user_contact(uuid) to authenticated;
