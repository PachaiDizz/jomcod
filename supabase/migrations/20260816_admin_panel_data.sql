-- =============================================================
-- JomCOD — Aug 16: Enrich admin panel data
--
-- Gives the admin what they need to actually review runners and
-- moderate jobs/reports:
--   * admin_list_runners  → adds whatsapp + services
--   * admin_list_jobs     → adds requester/runner names + job total
--
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
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
      'whatsapp', whatsapp,
      'services', services,
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
      'id', j.id,
      'service_type', j.service_type,
      'status', j.status,
      'take_from', j.take_from,
      'deliver_to', j.deliver_to,
      'requester_id', j.requester_id,
      'runner_id', j.runner_id,
      'requester_name', coalesce(pr.username, pr.full_name, 'Community'),
      'runner_name', coalesce(pu.username, pu.full_name, '—'),
      'total', (regexp_match(j.notes, 'Total:\s*(RM[0-9.]+)'))[1],
      'created_at', j.created_at)
    order by j.created_at desc), '[]'::jsonb)
  into v_data
  from (select * from public.jobs order by created_at desc limit 100) j
  left join public.profiles pr on pr.id = j.requester_id
  left join public.profiles pu on pu.id = j.runner_id;
  return v_data;
end $$;

revoke execute on function public.admin_list_jobs() from public;
grant execute on function public.admin_list_jobs() to authenticated;
