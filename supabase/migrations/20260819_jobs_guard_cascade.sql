-- =============================================================
-- JomCOD — Aug 19: Fix account deletion when the user is the assigned
-- runner on a job
--
-- Deleting a user who was the runner_id on any job failed with
-- "Runner of a job cannot be changed": the auth.users delete cascades
-- jobs.runner_id to NULL (on delete set null), which tripped the
-- jobs_guard_status BEFORE UPDATE trigger.
--
-- Fix: the guard now only blocks runner changes while the old runner's
-- account STILL EXISTS. When the account has actually been deleted the
-- cascade may null the column (history is kept for the requester).
--
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
-- =============================================================

create or replace function public.jobs_guard_status()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if old.requester_id is distinct from new.requester_id then
      raise exception 'Requester of a job cannot be changed';
    end if;
    -- Runner changes are blocked EXCEPT when the old runner's account was
    -- deleted (cascade sets runner_id null on referencing jobs).
    if old.runner_id is not null
       and old.runner_id is distinct from new.runner_id
       and exists (select 1 from auth.users where id = old.runner_id) then
      raise exception 'Runner of a job cannot be changed';
    end if;
    if old.status is distinct from new.status and not (
        (old.status = 'pending'  and new.status in ('confirmed','cancelled','expired'))
     or (old.status = 'confirmed' and new.status in ('done','cancelled'))
     or (old.status = 'done'      and new.status = 'done')
    ) then
      raise exception 'Invalid job status transition: % -> %', old.status, new.status;
    end if;
  end if;
  return new;
end $$;
