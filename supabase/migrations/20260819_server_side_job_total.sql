-- =============================================================
-- JomCOD — Aug 19: Server-side job total (anti-tampering)
--
-- Fixes OPEN_ISSUES.md #4. The "Total: RM…" line in jobs.notes was
-- written from the client: create_request() stored a client-computed
-- estimate, and set_job_total() let EITHER the requester or the
-- assigned runner rewrite it to any number. Either party could change
-- what the other side sees ("You pay RM…") and what "Est. earned" sums.
--
-- Fix: the total is now computed SERVER-SIDE from the assigned runner's
-- stored service pricing and written only by SECURITY DEFINER functions.
-- The client no longer supplies the number anywhere.
--
--   compute_job_total()     — internal: prices a job from the assigned
--                             runner's stored services (flat / per-item),
--                             matching the app's client estimate. Returns
--                             NULL when nothing is auto-computable (custom
--                             pricing, service not offered, no runner) —
--                             then no Total line is stored and the parties
--                             agree on WhatsApp (payment is out of scope).
--   create_request()        — strips any client-sent "Total:" line, then
--                             prices the job server-side when a runner is
--                             chosen.
--   set_job_total(job_id)   — re-prices a claimed job (used after a
--                             broadcast is claimed); returns the new
--                             "RM…" value or NULL.
--
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- =============================================================

-- 1) Internal helpers -------------------------------------------------

-- Clean a stored service name the same way the client does (strip courier
-- words / parenthetical courier lists, collapse spaces).
create or replace function public.clean_service_name(p_name text)
returns text language sql immutable as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(p_name, ''), '\([^)]*(JNT|SPX|GDEX)[^)]*\)', '', 'gi'),
        '(JNT|SPX Express|SPX|GDEX|Ninja Van|Pos Laju|Poslaju|Flash|DHL|Best Express)', '', 'gi'
      ),
      '\s{2,}', ' ', 'g'
    )
  );
$$;

-- Format a numeric total like the app ("RM24", "RM3.5").
create or replace function public.format_rm(p_value numeric)
returns text language sql immutable as $$
  select case
    when p_value = floor(p_value) then 'RM' || p_value::text
    else 'RM' || regexp_replace(round(p_value, 2)::text, '0$', '')
  end;
$$;

-- Count item quantities from an "Items:" value: "Rice ×2, Milk ×1" → 3.
create or replace function public.count_note_items(p_text text)
returns numeric language sql immutable as $$
  select coalesce(sum(
    case
      when trim(part) ~ '[×x*]\s*[0-9.]+' then (regexp_match(trim(part), '[×x*]\s*([0-9.]+)'))[1]::numeric
      when trim(part) <> '' then 1
      else 0
    end
  ), 0)
  from unnest(string_to_array(coalesce(p_text, ''), ',')) as part;
$$;

-- Count courier quantities from a take-from segment: "J&T ×3 items, SPX ×2 items" → 5.
create or replace function public.count_courier_qty(p_text text)
returns numeric language sql immutable as $$
  select coalesce(sum(m[1]::numeric), 0)
  from regexp_matches(coalesce(p_text, ''), '×\s*([0-9.]+)', 'g') as m;
$$;

-- Price a job from the assigned runner's stored services. NULL when no total
-- can be computed (custom pricing / service not offered / no runner).
create or replace function public.compute_job_total(
  p_service_type text,
  p_notes text,
  p_take_from text,
  p_runner_id uuid
) returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_services jsonb;
  v_names text[];
  v_items numeric[];
  v_line text;
  v_seg text;
  v_seg_name text;
  v_i int;
  v_j int;
  v_found boolean;
  v_count numeric;
  v_svc jsonb;
  v_model text;
  v_price numeric;
  v_total numeric := 0;
  v_current int := 1;
begin
  if p_runner_id is null then
    return null;
  end if;

  select services into v_services
    from public.profiles where id = p_runner_id;
  if v_services is null or jsonb_typeof(v_services) <> 'array' then
    return null;
  end if;

  -- Base services come from service_type ("A + B").
  v_names := string_to_array(lower(coalesce(p_service_type, '')), ' + ');
  if v_names is null or cardinality(v_names) = 0 then
    return null;
  end if;
  v_items := array_fill(0::numeric, array[cardinality(v_names)]);

  -- Notes: "Service:" lines add extra services; "Items:" lines count for the
  -- current (last seen) service.
  for v_line in select unnest(string_to_array(coalesce(p_notes, ''), E'\n')) loop
    if v_line ~* '^Service:\s*(.+)$' then
      v_names := v_names || lower(btrim(public.clean_service_name(regexp_replace(v_line, '^Service:\s*', '', 'i'))));
      v_items := v_items || 0::numeric;
      v_current := cardinality(v_names);
    elsif v_line ~* '^Items:\s*' then
      v_count := public.count_note_items(regexp_replace(v_line, '^Items:\s*', '', 'i'));
      v_items[v_current] := v_items[v_current] + v_count;
    end if;
  end loop;

  -- Take-from: "J&T ×3 items" (base segment) or "Service: J&T ×2 items".
  for v_seg in select unnest(string_to_array(coalesce(p_take_from, ''), ' · ')) loop
    v_seg := btrim(v_seg);
    if v_seg = '' then
      continue;
    end if;
    if v_seg ~* '^(.+?):\s*(.+)$' then
      v_seg_name := lower(btrim(public.clean_service_name(regexp_replace(v_seg, '^(.+?):\s*(.+)$', '\1', 'i'))));
      v_count := public.count_courier_qty(regexp_replace(v_seg, '^(.+?):\s*(.+)$', '\2', 'i'));
      v_j := 0;
      for v_i in 1 .. cardinality(v_names) loop
        if v_names[v_i] = v_seg_name then
          v_j := v_i;
          exit;
        end if;
      end loop;
      if v_j > 0 then
        v_items[v_j] := v_items[v_j] + v_count;
      end if;
    else
      v_items[1] := v_items[1] + public.count_courier_qty(v_seg);
    end if;
  end loop;

  -- Price each service from the runner's stored pricing.
  for v_i in 1 .. cardinality(v_names) loop
    v_found := false;
    v_model := null;
    v_price := null;
    for v_svc in select * from jsonb_array_elements(v_services) loop
      if lower(btrim(public.clean_service_name(coalesce(v_svc->>'name', '')))) = v_names[v_i] then
        v_model := v_svc->'pricing'->>'model';
        v_price := (v_svc->'pricing'->>'price')::numeric;
        v_found := true;
        exit;
      end if;
    end loop;
    if not v_found or v_model = 'custom' then
      return null; -- can't auto-price the whole job → no Total line (negotiate)
    end if;
    if v_model = 'flat_rate' and v_price is not null then
      v_total := v_total + v_price;
    elsif v_model = 'per_item' and v_price is not null and v_items[v_i] > 0 then
      v_total := v_total + v_items[v_i] * v_price;
    end if;
  end loop;

  if v_total <= 0 then
    return null;
  end if;
  return round(v_total, 2);
end $$;

revoke execute on function public.clean_service_name(text) from public;
revoke execute on function public.format_rm(numeric) from public;
revoke execute on function public.count_note_items(text) from public;
revoke execute on function public.count_courier_qty(text) from public;
revoke execute on function public.compute_job_total(text, text, text, uuid) from public;

-- 2) create_request(): strip any client-sent Total, price server-side -----

create or replace function public.create_request(
  p_service_type text,
  p_take_from text,
  p_deliver_to text,
  p_notes text default '',
  p_runner_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_requester uuid := auth.uid();
  v_new_id uuid := gen_random_uuid();
  v_active int;
  v_notes text;
  v_total numeric;
begin
  if v_requester is null then
    raise exception 'You must be signed in to request a service';
  end if;
  if exists (select 1 from public.profiles where id = v_requester and is_suspended) then
    raise exception 'Your account is suspended. Contact support for help.';
  end if;
  if nullif(p_service_type,'') is null then
    raise exception 'Service type is required';
  end if;
  if nullif(p_take_from,'') is null then
    raise exception 'Pickup details are required';
  end if;
  if nullif(p_deliver_to,'') is null then
    raise exception 'Delivery details are required';
  end if;
  if p_runner_id is not null and p_runner_id = v_requester then
    raise exception 'You cannot request your own service';
  end if;
  if p_runner_id is not null and exists (
    select 1 from public.blocks
    where (blocker_id = v_requester and blocked_id = p_runner_id)
       or (blocker_id = p_runner_id and blocked_id = v_requester)
  ) then
    raise exception 'You cannot request this runner right now';
  end if;

  select count(*) into v_active from public.jobs
    where requester_id = v_requester
      and status in ('pending','confirmed');
  if v_active >= 5 then
    raise exception 'You have too many active requests — finish or cancel one first';
  end if;

  if p_runner_id is not null then
    if exists (
      select 1 from public.jobs
      where requester_id = v_requester
        and runner_id = p_runner_id
        and service_type = p_service_type
        and status = 'pending'
    ) then
      raise exception 'You already have a pending request with this runner for that service';
    end if;
  else
    if exists (
      select 1 from public.jobs
      where requester_id = v_requester
        and runner_id is null
        and status = 'pending'
    ) then
      raise exception 'You already have an active broadcast — wait for it to expire or cancel it first';
    end if;
  end if;

  -- Never trust a client-supplied Total line; the total is recomputed below.
  v_notes := regexp_replace(coalesce(p_notes, ''), '(?im)^Total:\s*.*$', '');

  insert into public.jobs
    (id, requester_id, runner_id, service_type, take_from, deliver_to, notes, status)
  values
    (v_new_id, v_requester, p_runner_id, p_service_type, p_take_from, p_deliver_to, v_notes, 'pending');

  -- Price the job server-side when a specific runner is chosen (broadcasts
  -- are priced on claim instead, via set_job_total).
  if p_runner_id is not null then
    v_total := public.compute_job_total(p_service_type, v_notes, p_take_from, p_runner_id);
    if v_total is not null then
      update public.jobs
         set notes = v_notes || E'\nTotal: ' || public.format_rm(v_total)
       where id = v_new_id;
    end if;
  end if;

  return v_new_id;
end $$;

revoke execute on function public.create_request(text,text,text,text,uuid) from public;
grant execute on function public.create_request(text,text,text,text,uuid) to authenticated;

-- 3) set_job_total(): re-price from the runner's stored services -----------

drop function if exists public.set_job_total(uuid, text);
create or replace function public.set_job_total(p_job_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_requester uuid;
  v_runner uuid;
  v_service_type text;
  v_notes text;
  v_take_from text;
  v_total numeric;
begin
  if v_user is null then
    return null;
  end if;

  select requester_id, runner_id, service_type, notes, take_from
    into v_requester, v_runner, v_service_type, v_notes, v_take_from
    from public.jobs where id = p_job_id;
  if not found then
    raise exception 'Job not found';
  end if;
  if v_user <> v_runner and v_user <> v_requester then
    raise exception 'Not part of this job';
  end if;

  v_total := public.compute_job_total(v_service_type, v_notes, v_take_from, v_runner);

  if v_total is null then
    update public.jobs
       set notes = regexp_replace(coalesce(v_notes, ''), '(?im)^Total:\s*.*$', '')
     where id = p_job_id;
    return null;
  end if;

  if coalesce(v_notes, '') ~* '(?m)^Total:' then
    update public.jobs
       set notes = regexp_replace(coalesce(v_notes, ''), '(?im)^Total:\s*.*$', 'Total: ' || public.format_rm(v_total))
     where id = p_job_id;
  else
    update public.jobs
       set notes = coalesce(v_notes, '') || E'\nTotal: ' || public.format_rm(v_total)
     where id = p_job_id;
  end if;

  return public.format_rm(v_total);
end $$;

revoke execute on function public.set_job_total(uuid) from public;
grant execute on function public.set_job_total(uuid) to authenticated;
