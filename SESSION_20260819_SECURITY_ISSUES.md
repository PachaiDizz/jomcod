# JomCOD — Session Log: Critical Security + Role-Switch UX (Aug 19, 2026)

> Live site: **https://jomcod-eta.vercel.app**
> Deploys: `npx vercel --prod --yes --scope pachai-dizz1`
> Always verify with a hard refresh (**Ctrl+Shift+R**) so the service worker loads fresh.
> Tracking doc: `OPEN_ISSUES.md` (code review from Aug 19 2026).

---

## 1. 🔴 Issue #1 FIXED — Admin self-promotion / trust-flag escalation

**Commits:** `3e406e9`, plus client change in the same session (before `7f9d358`).

The profiles RLS update policy (`for update using (auth.uid() = id)`) had **no column
restriction**, so any signed-in user could run:

```sql
update public.profiles set is_admin = true where id = auth.uid();
```

…and immediately unlock every `admin_*` RPC. The same hole allowed self-approving
(`is_approved = true`) and un-suspending (`is_suspended = false`).

### Fix — `supabase/migrations/20260819_lock_trust_flags.sql` (applied to DB)

1. **Column-level revoke** (primary fix):
   ```sql
   revoke insert (is_admin, is_approved, is_suspended) on public.profiles from anon, authenticated;
   revoke update (is_admin, is_approved, is_suspended) on public.profiles from anon, authenticated;
   ```
   Admin RPCs are `SECURITY DEFINER` (run as table owner) and bypass column privileges;
   direct SQL-editor edits (postgres) are unaffected, so the one-time admin bootstrap
   in the phase-3 migration header still works.

2. **`profiles_trust_guard` BEFORE UPDATE trigger** (defense in depth, survives future
   re-grants): non-admins may **de-escalate** (`is_approved` true → false) but can never
   **raise** any trust flag; `auth.uid() is null` (direct DB edits) is always allowed.

3. **`set_role(text)` SECURITY DEFINER RPC** — the only client path that changes
   role + approval. Switching to Runner resets `is_approved = false` (re-approval
   required) and sets `status = 'offline'`.

### Client change — `lib/queries.ts` `switchRole()`

Now calls `set_role` RPC instead of the generic `updateProfile()` upsert (which used to
write `is_approved` directly and would have broken once the column was locked).

### Result

- Non-admins cannot raise `is_admin` / `is_approved` / `is_suspended`.
- Runner switching still works; switching to Runner always needs **admin re-approval**.
- One-time admin bootstrap via SQL editor preserved.

---

## 2. 🧭 Role switch simplified — Community ↔ Runner is now a direct flip

**Commit:** `7f9d358`.

Previously, switching Community → Runner opened a **services + schedule setup form** inside
Settings. Now:

- Settings → **"Switch to Runner"** is a single click that flips the role and lands on the
  runner dashboard. (Services/schedule are filled in there instead.)
- The runner dashboard already had everything needed:
  - empty-services **reminder card**,
  - full services editor (add / price / save),
  - **"go available" blocked** until at least one priced service exists,
  - "awaiting approval" banner while pending.
- Removed ~259 lines of setup-form code + 4 dead translation keys (en + bm).
- Runner → Community still uses the inline confirm; switching back keeps history/services.

---

## 3. Remaining issues (next)

Still open in `OPEN_ISSUES.md`:

- 🔴 **#2** Real secrets committed to a PUBLIC repo (VAPID private key, push secret, anon JWT).
- 🟠 **#3** Broadcast privacy regression (no status filter → cancelled/expired broadcasts readable).
- 🟠 **#4** Price-total tampering (`set_job_total` + client-computed estimates in `notes`).
- 🟠 **#5** Anon-triggered DB writes / write amplification (`refresh_availability` from anon).
- 🟡 **#6** Dashboard monolith + N+1 queries.
- 🟡 **#7** Hardcoded config that hides env drift.
- 🟡 **#8** No CSP / security headers.
- 🟡 **#9** ESLint never configured.
- 🟡 **#10** README.md badly stale.
- 🟢 **#11** Middleware dead code.
- 🟢 **#12** Name disclosure via `get_user_contact()`.
- 🛠 **Manual** — deploy the delete-account edge function.

---

## 4. ✅ Issue #3 FIXED — Broadcast open-board privacy

**Commit:** `2b41c89` · **Migration:** `20260819_broadcast_open_policy.sql` (applied).

The `"runners can read open broadcasts"` policy had no status filter, so approved
runners could read every historical cancelled/expired broadcast (incl. community
pickup/delivery addresses). Now requires `status = 'pending'` + `runner_id is null`
+ approved runner. Claimed jobs stay participants-only; stale broadcast
notification links land on "Job not found" (consistent with the Aug 14 privacy fix).

## 5. ✅ Issue #4 FIXED — Server-side job total (anti-tampering)

**Commit:** `1ba7bcc` · **Migration:** `20260819_server_side_job_total.sql` (applied) ·
client (deleted `lib/estimate.ts`).

The `Total: RM…` line was client-written; `set_job_total` let either party rewrite
it. Now computed **server-side** from the assigned runner's stored service pricing:
- `create_request()` strips any client `Total:` line and prices the job when a
  runner is chosen; broadcasts are priced on claim.
- `set_job_total(job_id)` — new signature, **no value param** — returns the computed
  "RM…" value; old `(uuid,text)` overload dropped.
- Custom-priced / unmatched services → no Total line (parties agree on WhatsApp).

## 6. ✅ Issue #5 FIXED — Maintenance jobs are pg_cron-only

**Commit:** `81876ee` · **Migration:** `20260819_cron_only_maintenance.sql` (applied) ·
client (`lib/queries.ts`, `app/dashboard`, `app/browse`).

`get_landing_stats()` no longer calls `refresh_availability()` (anon visitors never
write). `refresh_availability()` / `expire_stale_jobs()` revoked from anon +
authenticated; they run **only** via pg_cron every minute (re-asserted). Client-side
calls removed. ⚠️ pg_cron must stay enabled in Supabase.

## 7. ✅ Email/password sign-in enabled (no code change)

**Where:** Supabase Dashboard → Authentication → Providers → Email →
**"Confirm email" turned OFF** (2026-08-19).

Email signups were stuck behind the confirmation link (inbox/spam). Now new email
signups get an instant session and can log in directly. The app code already
handled both states (`app/page.tsx` `handleSignUp`: no session → "check your inbox";
session → straight into the app). No pending accounts needed unlocking
(`update auth.users set email_confirmed_at = now() ...` → 0 rows).

## 8. 🎨 New PWA icon — cutout logo (transparent background)

**Commits:** part of `92a5659` · **Source:** `Downloads/JomCOD2.png` (306×308).

- Cut the orange + white logo out of the dark tile (luminance keying via
  PowerShell/System.Drawing), centered with safe-zone padding.
- Generated `public/icon-512.png`, `public/icon-192.png`, `app/icon.png`.
- Service-worker cache bumped **v8 → v9** so installed PWAs refetch the icons.
- ⚠️ Installed PWAs keep the old home-screen icon until removed & re-added (iOS).

## 9. 🆕 "What's new" update popup + versioning

**Commits:** `92a5659`, `58cc440`, `3ce5b1d`, `3c5e7ae`, `158f5a6`.

- `components/UpdateNotice.tsx` — modal shown **once per browser per version**
  (localStorage key `jomcod_update_<APP_VERSION>`), items rendered through `Md`
  so the main point of each note is **bold**.
- Items shipped (v1.1.0): Change role anytime · Delete account · Private requests
  · Fair pricing (EN + BM).
- Reopenable anytime via a `jomcod:show-update` custom event — entry placed on
  the **About page** (under App Information → version row), after initially being
  tried in Settings.
- **Versioning:** `lib/version.ts` (`APP_VERSION = "1.1.0"`) is the single source
  of truth; About page renders "Version **1.1.0**" from it; `package.json` synced.
  Bump the constant per release → the popup reappears automatically.

## 10. 📄 CHANGELOG.md — versioned release notes

**Commit:** `a98658c`.

- New `CHANGELOG.md` is the single home for all updates/fixes/additions, grouped
  by version: **v1.1.0** (Aug 19: role switch, delete account, instant email
  sign-up, popup + versioning, new icon, server-side pricing, broadcast privacy,
  trust-flag security) and **v1.0.0** (launch baseline).
- Header documents the release workflow: bump `APP_VERSION` → add a `## [x.y.z]`
  entry → deploy.

## 11. Remaining (as of 2026-08-19)

- 🔴 **#2** Real secrets committed to a PUBLIC repo (VAPID private key, push secret, anon JWT).
- 🟡 **#6** Dashboard monolith + N+1 queries.
- 🟡 **#7** Hardcoded config that hides env drift.
- 🟡 **#8** No CSP / security headers.
- 🟡 **#9** ESLint never configured.
- 🟡 **#10** README.md badly stale.
- 🟢 **#11** Middleware dead code.
- 🟢 **#12** Name disclosure via `get_user_contact()`.
- 🛠 **Manual** — deploy the delete-account edge function.
