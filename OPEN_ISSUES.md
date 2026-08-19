# JomCOD — Open Issues (from code review, Aug 19 2026)

> Saved so we can work through these later. Bugs are listed by severity with
> the exact file:line and the shape of the fix. Features already shipped
> (Settings delete-account + switch role) are tracked in git commit `ae1374a`.
>
> **Status (Aug 19 2026):** #1, #3, #4, #5 fixed (migrations ready to apply) +
> role switch simplified — see `SESSION_20260819_SECURITY_ISSUES.md`. Remaining:
> #2, #6 – #12 + the manual step.

---

## 🔴 CRITICAL

### 1. ~~Any user can self-promote to admin (and self-approve as a runner)~~ ✅ FIXED

- **Fixed in:** `supabase/migrations/20260819_lock_trust_flags.sql` (run in the
  SQL editor), plus `lib/queries.ts` `switchRole()`.
- **What changed:**
  - `revoke insert/update (is_admin, is_approved, is_suspended) on public.profiles
    from anon, authenticated;` — admin RPCs are `SECURITY DEFINER` and bypass
    column privileges; direct SQL-editor edits (postgres) still work, so the
    one-time admin bootstrap is preserved.
  - `profiles_trust_guard` BEFORE UPDATE trigger (defense in depth): non-admins
    may de-escalate (`is_approved` true → false) but can never raise any trust
    flag; `auth.uid() is null` (direct DB edits) is always allowed.
  - `set_role()` `SECURITY DEFINER` RPC is now the only client path that changes
    role + approval; `switchRole()` calls it instead of the generic
    `updateProfile()` upsert.
- **Verify:** apply the migration, then confirm `update profiles set is_admin = true
  where id = auth.uid()` is rejected for a non-admin, and Settings → Switch role
  still works (runner switch resets approval).

### 2. Real secrets committed to a PUBLIC repo (`PachaiDizz/jomcod`)

- **Where:**
  - VAPID **private** key — `supabase/functions/send-push/index.ts:46`
  - Push secret (in `app_secrets`) — `supabase/migrations/20260814_push_notifications.sql:56`
  - Also hardcoded: anon JWT (`:88`) and the Supabase URL.
- **Impact:** anyone can forge/spam push notifications or call the edge function directly.
- **Fix:** rotate both keys (regenerate VAPID pair, change the `push_secret` in
  both `app_secrets` and the edge function env var), remove them from the repo,
  and keep them env-only. Also scrub the git history (or accept the risk and just fix going forward).

---

## 🟠 HIGH

### 3. ~~Broadcast privacy regression~~ ✅ FIXED (apply migration)

- **Fixed in:** `supabase/migrations/20260819_broadcast_open_policy.sql` (run in
  the SQL editor).
- **What changed:** the `"runners can read open broadcasts"` policy now requires
  `status = 'pending'` in addition to `runner_id is null` + approved runner, so
  cancelled/expired broadcasts (with community addresses) are no longer readable.
  Claimed broadcasts stay participants-only; notification links for stale
  broadcast notices now land on the job "not found" page (consistent with the
  Aug 14 notification-privacy fix).
- **Verify:** after applying, the Open-requests board still lists pending
  broadcasts, and a cancelled/expired broadcast returns no row for a runner.

### 4. ~~Price-total tampering~~ ✅ FIXED (apply migration)

- **Fixed in:** `supabase/migrations/20260819_server_side_job_total.sql` (run in
  the SQL editor) + client changes (`lib/queries.ts`, `app/dashboard`,
  `app/job/[id]`, `app/request`, `components/RequestFields.tsx`; deleted
  `lib/estimate.ts`).
- **What changed:** the total is now computed **server-side** from the assigned
  runner's stored service pricing:
  - `create_request()` strips any client-sent `Total:` line and prices the job
    when a runner is chosen; broadcasts stay unpriced until claimed.
  - `set_job_total(job_id)` (new signature — no value param) re-prices a claimed
    job and returns the new "RM…" value; either party calling it always gets the
    same server-computed number.
  - Custom-priced services / unmatched services → no Total line at all (parties
    agree on WhatsApp). Client no longer supplies or trusts a total anywhere.
- **Verify:** after applying, a direct request to a runner stores the
  server-computed total; `set_job_total(<id>, 'RM1')` no longer exists, and a
  custom-priced broadcast keeps no Total line.

### 5. ~~Anon-triggered DB writes / write amplification~~ ✅ FIXED (apply migration)

- **Fixed in:** `supabase/migrations/20260819_cron_only_maintenance.sql` (run in
  the SQL editor) + client changes (`lib/queries.ts`, `app/dashboard`,
  `app/browse`).
- **What changed:** `get_landing_stats()` no longer calls
  `refresh_availability()` — it's read-only now, so anonymous landing visitors
  never trigger a DB write. `refresh_availability()` and `expire_stale_jobs()`
  are revoked from anon + authenticated; they run **only** via pg_cron every
  minute (re-asserted in the migration). Client-side calls removed.
- **Requires:** pg_cron enabled in Supabase (Database → Extensions). Board +
  availability are now up to ~1 minute stale instead of instant, which is fine.
- **Verify:** after applying, a signed-out landing visit does not UPDATE
  `profiles`; `refresh_availability` / `expire_stale_jobs` RPC calls fail for
  clients.

---

## 🟡 MEDIUM

### 6. Dashboard monolith + N+1 queries

- **Where:** `app/dashboard/page.tsx` (1,938 lines). The 8s poll calls
  `loadContacts()` → one `get_user_contact` RPC per job, plus `fetchReviewForJob`
  per done job, on top of realtime.
- **Fix:** batch contacts/reviews into single queries; reduce poll frequency; split
  the page into role components.

### 7. Hardcoded config that hides env drift

- **Where:** `app/layout.tsx:40` hardcodes the Supabase origin for preconnect;
  `lib/push.ts:5` and `supabase/functions/send-push/index.ts:41-46` fall back to
  hardcoded VAPID keys.
- **Fix:** read from `process.env.NEXT_PUBLIC_SUPABASE_URL`; fail loudly if VAPID
  env keys are missing in production instead of silently falling back.

### 8. No CSP / security headers

- **Where:** `next.config.js` has no `headers()` config.
- **Fix:** add security headers (CSP, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy) via `next.config.js`.

### 9. ESLint never configured

- **Where:** `npm run lint` opens the interactive setup prompt (no `.eslintrc`).
- **Fix:** add `eslint` + `eslint-config-next`, a config file, and a `lint`
  script; only `tsc` guards the code today.

### 10. README.md is badly stale

- **Where:** `README.md` still describes the app as mock/no-backend with the old
  name, while `PROJECT.md` is current. Public repo → confusing for contributors.
- **Fix:** rewrite or point it at `PROJECT.md`.

---

## 🟢 LOW

### 11. Middleware dead code

- **Where:** `middleware.ts:43` `homeFor(role)` always returns `/dashboard` and
  ignores its `role` arg.
- **Fix:** remove the parameter or implement real role-based landing.

### 12. Name disclosure via get_user_contact()

- **Where:** `supabase/migrations/20260813_phase1_security_phase2_reliability.sql:466-468`
  returns the target's name to any signed-in caller even with no shared job.
- **Fix:** return name only when a job relationship exists (like the WhatsApp gate).

---

## 🛠 Manual step (not code)

- **Deploy the delete-account edge function** so Settings → Delete Account works:
  ```
  supabase functions deploy delete-account
  ```
  Until then the button shows "Account deletion isn't ready yet…".
