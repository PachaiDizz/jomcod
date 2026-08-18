# JomCOD — Open Issues (from code review, Aug 19 2026)

> Saved so we can work through these later. Bugs are listed by severity with
> the exact file:line and the shape of the fix. Features already shipped
> (Settings delete-account + switch role) are tracked in git commit `ae1374a`.

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

### 3. Broadcast privacy regression

- **Where:** `supabase/migrations/20260814_broadcast_visibility.sql:21-22`
  `"runners can read open broadcasts"` policy = `auth.uid() is not null and runner_id is null`
  with **no status filter**.
- **Impact:** runners can read every historical cancelled/expired broadcast,
  including community pickup/delivery addresses.
- **Fix:** keep the widened read only for notification-linked jobs (the existing
  `"users can read jobs they were notified about"` policy), and restore
  `status = 'pending'` to the open-board policy. Verify the Open-requests board
  + broadcast notification links still resolve.

### 4. Price-total tampering

- **Where:** `supabase/migrations/20260814_broadcast_visibility.sql:38-77`
  `set_job_total()` lets the requester OR the assigned runner rewrite the
  `Total: RM…` line in `jobs.notes`; the initial estimate is also client-computed
  and stored in `notes` by `create_request`.
- **Impact:** either party can change what the other side sees ("You pay RM…")
  and what the runner's "Est. earned" sums.
- **Fix:** server-side integrity — e.g. recompute the total from the runner's
  stored service pricing inside a `SECURITY DEFINER` function instead of trusting
  client `notes`, or store `total` as its own column set only by that function.

### 5. Anon-triggered DB writes / write amplification

- **Where:** `get_landing_stats()` (granted to `anon`) calls
  `refresh_availability()` which UPDATEs `profiles`; `refresh_availability()`
  and `expire_stale_jobs()` are also granted to all `authenticated` and called on
  every dashboard load.
- **Impact:** every anonymous landing visitor triggers a DB write; cheap
  DoS/write-amplification vector at scale.
- **Fix:** run these from pg_cron only, and drop the client-side calls (or keep a
  lightweight authenticated-only version).

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
