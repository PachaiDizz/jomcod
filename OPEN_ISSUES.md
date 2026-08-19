# JomCOD — Open Issues (from code review, Aug 19 2026)

> Saved so we can work through these later. Bugs are listed by severity with
> the exact file:line and the shape of the fix. Features already shipped
> (Settings delete-account + switch role) are tracked in git commit `ae1374a`.
>
> **Status (Aug 19 2026):** #1, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12 fixed +
> role switch simplified — see `SESSION_20260819_SECURITY_ISSUES.md` and
> `CHANGELOG.md`. Remaining: #2 (secrets — rotation) + the manual step.

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

### 6. ~~Dashboard monolith + N+1 queries~~ ✅ FIXED (apply migration)

- **Fixed in:** `supabase/migrations/20260819_batch_contacts.sql` (run in the SQL
  editor) + `lib/queries.ts` + `app/dashboard/page.tsx`.
- **What changed:** contacts now resolve via ONE batch RPC
  (`get_user_contacts(uuid[])`) instead of one `get_user_contact` call per job;
  reviews for completed jobs load in a single `.in(job_id)` query; the fallback
  poll dropped 8s → 15s.
- **Still open (maintainability, not perf):** the page is still one large
  `app/dashboard/page.tsx`; splitting it into role components is a future
  refactor.
- **Verify:** after applying, open the dashboard — one `get_user_contacts` call
  (not N) and one reviews query (not N).

### 7. ~~Hardcoded config that hides env drift~~ ✅ FIXED

- **Fixed in:** `app/layout.tsx`, `lib/push.ts`, `supabase/functions/send-push/index.ts`.
- **What changed:** the Supabase preconnect origin reads `NEXT_PUBLIC_SUPABASE_URL`
  (fallback only when unset); the client VAPID public key comes from
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (push not offered when missing); the `send-push`
  edge function requires `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` env secrets and
  returns 500 instead of using the embedded keys (which also removes the private
  key from the repo — the remaining piece is rotation, tracked in #2).
- **Deploy requirements:** set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in Vercel and the
  two VAPID secrets on the `send-push` edge function, or web push stops working
  (in-app notifications unaffected).

### 8. ~~No CSP / security headers~~ ✅ FIXED

- **Fixed in:** `next.config.js` `headers()`.
- **What changed:** CSP (script/style inline, Supabase connect + wss, rss2json),
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
  (camera/mic/geolocation/payment blocked).

### 9. ~~ESLint never configured~~ ✅ FIXED

- **Fixed in:** `.eslintrc.json` + devDeps `eslint` + `eslint-config-next`.
- **What changed:** `npm run lint` works (`next/core-web-vitals`), zero warnings
  or errors. Fixed the one error (TopNav comment textnode) + two hook-dep warnings.

### 10. ~~README.md is badly stale~~ ✅ FIXED

- **Fixed in:** `README.md` rewritten — real Supabase-backed stack, scripts,
  structure, pointers to `PROJECT.md` / `CHANGELOG.md` / `OPEN_ISSUES.md` /
  `NEEDFIX.md`, and key RLS/security rules.

---

## 🟢 LOW

### 11. ~~Middleware dead code~~ ✅ FIXED

- **Fixed in:** `middleware.ts` — `homeFor()` no longer takes an ignored `role`
  arg (both roles land on `/dashboard`, which is role-aware).

### 12. ~~Name disclosure via get_user_contact()~~ ✅ FIXED (apply migration)

- **Fixed in:** `supabase/migrations/20260819_contact_privacy.sql` (run in the
  SQL editor).
- **What changed:** the fallback that returned a user's name to any signed-in
  caller is gone — with no shared job the function returns NULL. The batch
  variant `get_user_contacts()` applies the same relationship gate.
- **Verify:** after applying, `get_user_contact(<unrelated id>)` returns null.

---

## 🛠 Manual step (not code)

- **Deploy the delete-account edge function** so Settings → Delete Account works:
  ```
  supabase functions deploy delete-account
  ```
  Until then the button shows "Account deletion isn't ready yet…".
