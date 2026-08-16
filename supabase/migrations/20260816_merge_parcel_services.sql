-- =============================================================
-- JomCOD — Aug 16: Merge "Parcel Pickup" and "Parcel Drop-off"
-- into a single "Parcel Pickup / Drop-off" service.
--
-- A parcel errand often mixes both picking up and dropping off
-- (or is just a straight delivery), so runners list one combined
-- service instead of two. Renames every stored OLD name to the
-- combined name so existing pricing and job history keep matching
-- the app's preset list.
--
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- =============================================================

-- 1) Runner profiles: merge inside the services JSONB array,
--    preserving each service's pricing.
update public.profiles
set services = (
  select coalesce(jsonb_agg(
    case
      when s->>'name' in ('Parcel Pickup', 'Parcel Drop-off') then jsonb_set(s, '{name}', '"Parcel Pickup / Drop-off"')
      else s
    end
  ), '[]'::jsonb)
  from jsonb_array_elements(services) s
)
where services is not null and jsonb_typeof(services) = 'array';

-- 2) Jobs: rename the service_type (a job can have "A + B" combined services).
update public.jobs
set service_type = replace(
  replace(service_type, 'Parcel Pickup', 'Parcel Pickup / Drop-off'),
  'Parcel Drop-off', 'Parcel Pickup / Drop-off')
where service_type is not null;

-- 3) Job notes ("Service: <name>" lines) — same merge.
update public.jobs
set notes = replace(
  replace(notes, 'Parcel Pickup', 'Parcel Pickup / Drop-off'),
  'Parcel Drop-off', 'Parcel Pickup / Drop-off')
where notes is not null;

-- 4) Notifications bodies that embed the service name.
update public.notifications
set body = replace(
  replace(body, 'Parcel Pickup', 'Parcel Pickup / Drop-off'),
  'Parcel Drop-off', 'Parcel Pickup / Drop-off')
where body is not null;
