-- =============================================================
-- JomCOD — Aug 14: Web Push notifications
--
-- Adds the pieces that let the phone get a real push notification
-- even when the app is closed:
--   1. push_subscriptions — where each user's push subscription is saved
--   2. app_secrets — stores the push secret (no RLS policies = nobody
--      reads it except SECURITY DEFINER functions)
--   3. jobs_notify() — now ALSO fires a web push for key job events by
--      calling the edge function over pg_net.
--
-- NOTE: the function is deployed under the name `hyper-api` on this project
-- (rename in the dashboard didn't move the deployed URL), so the trigger
-- points at /functions/v1/hyper-api.
--
-- To activate you must ALSO (see instructions):
--   - Create the edge function (supabase/functions/send-push/index.ts)
--   - Set its env vars: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SECRET
--
-- Safe to re-run.
-- =============================================================

-- pg_net lets the DB trigger call the edge function (fire-and-forget).
create extension if not exists pg_net;

-- 1) Push subscriptions — the client saves its push endpoint here.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (endpoint)
);

alter table public.push_subscriptions enable row level security;
drop policy if exists "users manage their own push subscriptions" on public.push_subscriptions;
create policy "users manage their own push subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- 2) Secret store — no select policy, so only SECURITY DEFINER functions
--    (like push_user below) can read it. Anon/authenticated users cannot.
create table if not exists public.app_secrets (
  key text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;

-- ⚠️ This value must ALSO be set as the `PUSH_SECRET` env var on the
-- send-push edge function. Change it here AND there together.
insert into public.app_secrets (key, value)
values ('push_secret', '0c3e0de32186ee128ac02b62cdd08dab2f8aa02dea26df8f')
on conflict (key) do update set value = excluded.value;

-- 3) Push firing helper — calls the edge function if the target has a
--    subscription, otherwise does nothing.
create or replace function public.push_user(
  p_user_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_job_id uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_secret text;
begin
  if p_user_id is null then
    return;
  end if;
  -- No subscription → nothing to do (skips the HTTP call too).
  if not exists (select 1 from public.push_subscriptions where user_id = p_user_id) then
    return;
  end if;

  select value into v_secret from public.app_secrets where key = 'push_secret';
  if v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := 'https://vjanzunjalhrghikqzsy.supabase.co/functions/v1/hyper-api',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqYW56dW5qYWxocmdoaWtxenN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NDYwODgsImV4cCI6MjEwMjAyMjA4OH0.u2cLsdGs9usLY6FFtqWPrkZZ5ysDwSd33Hi03zGoj2I',
      'x-push-secret', v_secret
    ),
    body := jsonb_build_object(
      'target_user_id', p_user_id,
      'kind', p_kind,
      'title', p_title,
      'body', p_body,
      'job_id', p_job_id
    )
  );
end $$;

-- 4) jobs_notify(): same in-app notifications as before, plus a push call
--    for each recipient.
create or replace function public.jobs_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.runner_id is not null then
      insert into public.notifications (user_id, kind, title, body, job_id)
      values (new.runner_id, 'new_request', 'New request',
        new.service_type || ' · ' || new.take_from || ' → ' || new.deliver_to, new.id);
      perform public.push_user(new.runner_id, 'new_request', 'New request',
        new.service_type || ' · ' || new.take_from || ' → ' || new.deliver_to, new.id);
    else
      insert into public.notifications (user_id, kind, title, body, job_id)
      select id, 'new_broadcast', 'New broadcast request',
        new.service_type || ' · ' || new.take_from, new.id
      from public.profiles
      where role = 'runner' and is_approved and not is_suspended and id <> new.requester_id;

      perform public.push_user(id, 'new_broadcast', 'New broadcast request',
        new.service_type || ' · ' || new.take_from, new.id)
      from public.profiles
      where role = 'runner' and is_approved and not is_suspended and id <> new.requester_id;
    end if;
    return new;
  end if;

  if old.status is distinct from new.status then
    if new.status = 'confirmed' and old.status = 'pending' then
      insert into public.notifications (user_id, kind, title, body, job_id)
      values (new.requester_id, 'accepted', 'Runner accepted your request',
        new.service_type, new.id);
      perform public.push_user(new.requester_id, 'accepted', 'Runner accepted your request',
        new.service_type, new.id);

      if old.runner_id is null then
        -- Broadcast claimed: other runners lose the stale notification,
        -- get a bare "already taken" notice (in-app + push), no details.
        insert into public.notifications (user_id, kind, title, body, job_id)
        select user_id, 'broadcast_taken', 'Request already taken',
               'This request has already been accepted by another runner.', null
        from public.notifications
        where job_id = new.id and kind = 'new_broadcast' and user_id <> new.runner_id;

        perform public.push_user(user_id, 'broadcast_taken', 'Request already taken',
          'This request has already been accepted by another runner.', new.id)
        from public.notifications
        where job_id = new.id and kind = 'new_broadcast' and user_id <> new.runner_id;

        delete from public.notifications
        where job_id = new.id and kind = 'new_broadcast' and user_id <> new.runner_id;
      end if;
    elsif new.status = 'done' and old.status = 'confirmed' then
      insert into public.notifications (user_id, kind, title, body, job_id)
      values (new.requester_id, 'done', 'Request completed', new.service_type, new.id);
      perform public.push_user(new.requester_id, 'done', 'Request completed',
        new.service_type, new.id);
    elsif new.status = 'expired' and old.status = 'pending' then
      insert into public.notifications (user_id, kind, title, body, job_id)
      values (new.requester_id, 'expired', 'Your request expired', new.service_type, new.id);
      perform public.push_user(new.requester_id, 'expired', 'Your request expired',
        new.service_type, new.id);
    elsif new.status = 'cancelled' and old.status in ('pending','confirmed') then
      if new.cancelled_by = new.requester_id then
        insert into public.notifications (user_id, kind, title, body, job_id)
        values (new.runner_id, 'cancelled', 'Request cancelled', new.service_type, new.id);
        perform public.push_user(new.runner_id, 'cancelled', 'Request cancelled',
          new.service_type, new.id);
      else
        insert into public.notifications (user_id, kind, title, body, job_id)
        values (new.requester_id, 'declined', 'Runner declined your request', new.service_type, new.id);
        perform public.push_user(new.requester_id, 'declined', 'Runner declined your request',
          new.service_type, new.id);
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists jobs_notify_trigger on public.jobs;
create trigger jobs_notify_trigger
  after insert or update on public.jobs
  for each row execute function public.jobs_notify();
