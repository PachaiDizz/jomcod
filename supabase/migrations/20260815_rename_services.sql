-- =============================================================
-- JomCOD — Aug 15: Rename services to the final categorized names
--
-- Keeps the Runner and Community sides in sync after the service list
-- was reorganized. Renames every OLD stored name to its NEW name so
-- existing runner pricing and job history keep matching the app logic.
--
-- Renames:
--   Drop-Off Parcel                  → Parcel Drop-off
--   Pay Bills (Toll / Water / Electric) → Pay Bills
--   Top-Up / Reload Card             → Top-Up / Reload
--   Other Errand                     → Other (specify)
--   Laundry Drop-Off / Pickup        → Laundry Drop-Off/Pickup
--   Buy Groceries For Me             → Other (specify)  (dropped service)
--   Shop Errand                      → Other (specify)  (dropped service)
--
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- =============================================================

-- 1) Runner profiles: rename inside the services JSONB array, preserving
--    each service's pricing.
update public.profiles
set services = (
  select coalesce(jsonb_agg(
    case
      when s->>'name' = 'Drop-Off Parcel' then jsonb_set(s, '{name}', '"Parcel Drop-off"')
      when s->>'name' = 'Pay Bills (Toll / Water / Electric)' then jsonb_set(s, '{name}', '"Pay Bills"')
      when s->>'name' = 'Top-Up / Reload Card' then jsonb_set(s, '{name}', '"Top-Up / Reload"')
      when s->>'name' = 'Other Errand' then jsonb_set(s, '{name}', '"Other (specify)"')
      when s->>'name' = 'Laundry Drop-Off / Pickup' then jsonb_set(s, '{name}', '"Laundry Drop-Off/Pickup"')
      when s->>'name' in ('Buy Groceries For Me', 'Shop Errand') then jsonb_set(s, '{name}', '"Other (specify)"')
      else s
    end
  ), '[]'::jsonb)
  from jsonb_array_elements(services) s
)
where services is not null and jsonb_typeof(services) = 'array';

-- 2) Jobs: rename the service_type (a job can have "A + B" combined services).
update public.jobs
set service_type = replace(
  replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              service_type,
              'Drop-Off Parcel', 'Parcel Drop-off'),
            'Pay Bills (Toll / Water / Electric)', 'Pay Bills'),
          'Top-Up / Reload Card', 'Top-Up / Reload'),
        'Other Errand', 'Other (specify)'),
      'Laundry Drop-Off / Pickup', 'Laundry Drop-Off/Pickup'),
    'Buy Groceries For Me', 'Other (specify)'),
  'Shop Errand', 'Other (specify)')
where service_type is not null;

-- 3) Job notes ("Service: <name>" lines) — same renames.
update public.jobs
set notes = replace(
  replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              notes,
              'Drop-Off Parcel', 'Parcel Drop-off'),
            'Pay Bills (Toll / Water / Electric)', 'Pay Bills'),
          'Top-Up / Reload Card', 'Top-Up / Reload'),
        'Other Errand', 'Other (specify)'),
      'Laundry Drop-Off / Pickup', 'Laundry Drop-Off/Pickup'),
    'Buy Groceries For Me', 'Other (specify)'),
  'Shop Errand', 'Other (specify)')
where notes is not null;

-- 4) Notifications bodies that embed the service name.
update public.notifications
set body = replace(
  replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              body,
              'Drop-Off Parcel', 'Parcel Drop-off'),
            'Pay Bills (Toll / Water / Electric)', 'Pay Bills'),
          'Top-Up / Reload Card', 'Top-Up / Reload'),
        'Other Errand', 'Other (specify)'),
      'Laundry Drop-Off / Pickup', 'Laundry Drop-Off/Pickup'),
    'Buy Groceries For Me', 'Other (specify)'),
  'Shop Errand', 'Other (specify)')
where body is not null;
