-- =============================================================
-- JomCOD — Aug 19: Batch contact lookup (fixes dashboard N+1)
--
-- The dashboard was calling get_user_contact() once PER job (one RPC each),
-- and again on every poll. This adds get_user_contacts() which resolves many
-- user ids in a single call, applying the SAME relationship gate as
-- get_user_contact(): only users sharing a job with the caller are returned
-- (whatsapp included), everyone else is omitted entirely.
--
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- =============================================================

create or replace function public.get_user_contacts(p_user_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_result jsonb;
begin
  if v_caller is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'name', coalesce(p.username, p.full_name, 'Runner'),
      'whatsapp', coalesce(p.whatsapp, '')
    )), '[]'::jsonb)
    into v_result
  from public.profiles p
  where p.id = any(p_user_ids)
    and (
      p.id = v_caller
      or exists (
        select 1 from public.jobs j
        where j.requester_id = v_caller
          and j.runner_id = p.id
          and j.status in ('confirmed','done')
      )
      or exists (
        select 1 from public.jobs j
        where j.requester_id = p.id
          and j.runner_id = v_caller
          and j.status in ('pending','confirmed','done')
      )
    );

  return v_result;
end $$;

revoke execute on function public.get_user_contacts(uuid[]) from public;
grant execute on function public.get_user_contacts(uuid[]) to authenticated;
