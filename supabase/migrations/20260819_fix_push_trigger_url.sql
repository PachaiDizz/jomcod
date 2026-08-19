-- =============================================================
-- JomCOD — Aug 19: Point the push trigger at the `send-push` edge
-- function (the deployed name is now the real one; the old `hyper-api`
-- URL is stale and the function was re-deployed fresh as `send-push`).
--
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- =============================================================

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
    url := 'https://vjanzunjalhrghikqzsy.supabase.co/functions/v1/send-push',
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
