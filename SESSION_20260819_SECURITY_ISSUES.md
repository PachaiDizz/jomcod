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
