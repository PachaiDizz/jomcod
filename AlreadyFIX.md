# JomCOD — Already Fixed ✅

> Everything below has been implemented and applied to the database.
> The SQL migration `supabase/migrations/20260813_phase1_security_phase2_reliability.sql`
> was run once in the Supabase SQL editor (Success. No rows returned).
>
> These cover **Phase 1 (Security)** and **Phase 2 (Core reliability)** from `NEEDFIX.md`.

---

## Phase 1 — Security ✅

### Profile privacy
- `profiles` table is now **only readable by its owner** — no more public `SELECT true`.
- Public discovery goes through the new **`runner_profiles_public` view** which exposes only:
  username, display name, role, status, area, services, schedule, last seen, completed-job count.
- **WhatsApp number and home address (Sahabat / No. Rumah / Block) are never exposed publicly.**

### WhatsApp gating
- New `get_user_contact()` Postgres function (security definer).
- A user's WhatsApp is only returned once the two users share an **accepted / completed job**:
  - Community unlocks the runner's number after the runner accepts.
  - An assigned runner can reach the requester immediately.
- Runner profile + dashboards show the 💬 WhatsApp button **only when allowed**,
  otherwise "🔒 WhatsApp unlocks after your request is accepted".

### Jobs RLS hardened
- Direct `INSERT` / `UPDATE` on `jobs` is **removed**.
- All job lifecycle runs server-side through Postgres functions:
  - `create_request()` — create direct request or broadcast (with spam guards)
  - `accept_job()` — runner accepts a direct request
  - `decline_job()` — runner declines → `cancelled`
  - `mark_job_done()` — runner completes the job
  - `cancel_job()` — community cancels their request
  - `claim_broadcast()` — atomic first-to-accept for broadcasts
  - `expire_stale_jobs()` — server-side auto-expiry

### `claim_broadcast()` audit
- Only authenticated **runners** (role check) can claim.
- A runner **cannot claim their own broadcast**.
- Stale/expired broadcasts cannot be claimed (status + 5-minute window).
- A runner can only have **one active confirmed job** at a time.

### `SECURITY DEFINER` audit
- All functions set `search_path = public`.
- Grants restricted to `authenticated` (plus `anon` only where needed).
- Inputs validated; no function exposes unrelated data.

### Reviews hardened
- Ratings now go through `add_review()`.
- Only the **requester of a genuinely `done` job** can rate.
- One review per job (`unique job_id`).
- Direct INSERT/UPDATE on `reviews` removed.

---

## Phase 2 — Core reliability ✅

### Job state machine
- Added **`cancelled`** status to the DB.
- `jobs_status_guard` trigger rejects invalid transitions
  (`done→pending`, `expired→confirmed`, ownership edits, etc.) even if the app is bypassed.

### Cancellation
- Community can **cancel pending / confirmed** requests from "My requests".
- Runner **decline** now sets `cancelled` (not `expired`).

### Automatic job expiry (server-side)
- `expire_stale_jobs()` marks 5-minute-old pending broadcasts `expired` in the DB.
- Runs via **pg_cron every minute** + on dashboard load.
- No more client-only hiding of stale rows.

### Runner availability freshness
- New columns: `last_seen_at`, `availability_updated_at`.
- Runner's open dashboard **heartbeats every 30s** (`touch_availability()`).
- `refresh_availability()` auto-offlines stale "available" runners (5-min timeout).
- Runs via **pg_cron every minute** + on browse / dashboard / landing (`get_landing_stats`).
- Browse shows **"🟢 active Xm ago"** for transparency.

### Spam / duplicate protection
- `create_request()` guards:
  - Max **5 active requests** per user.
  - No duplicate pending request to the same runner + service.
  - One active broadcast at a time.
  - Cannot request your own service.

### WhatsApp validation
- `normalizeWhatsApp()` normalizes MY numbers:
  `012-3456789` → `+60123456789`.
- `isValidWhatsApp()` rejects invalid numbers on signup, onboarding and settings.
- `waLink()` builds robust `wa.me` links from any stored format.

> **Updated:** accepts **all** Malaysian mobile formats (010–019 prefixes), both
> 10-digit (`012-3456789`) and **11-digit** (`011-1234-5678` → `+601112345678`),
> with or without dashes / spaces / `+60` / `60`. Fixed in
> `lib/constants.ts` `normalizeWhatsApp()` (was rejecting 11-digit `01X` numbers).

### Indexes
- Added for real query patterns:
  - `jobs.requester_id`, `jobs.runner_id`, `jobs.status`, `jobs.created_at`
  - `profiles.role`, `profiles.status`, `profiles.area`, `profiles.last_seen_at`
  - `reviews.runner_id`

---

## File changes

- `supabase/migrations/20260813_phase1_security_phase2_reliability.sql` — **new** (run once, done)
- `lib/types.ts` — `cancelled` status, `lastSeenAt` on `Runner`
- `lib/constants.ts` — `normalizeWhatsApp`, `isValidWhatsApp`, `waLink`
- `lib/queries.ts` — public-view reads, RPC-based job actions, contact gating, availability functions
- `app/dashboard/page.tsx` — server-driven accept/decline/done/cancel, cancel button, heartbeat,
  gated WhatsApp, error toasts, `cancelled` styles
- `app/browse/page.tsx` — refreshes availability before listing
- `app/runner/[id]/page.tsx` — gated WhatsApp contact
- `app/request/page.tsx`, `app/broadcast/page.tsx` — use `create_request()` RPC
- `app/settings/page.tsx`, `app/onboarding/page.tsx`, `app/page.tsx` — WhatsApp validation/normalization
- `app/history/page.tsx` — `cancelled` status

---

## Next up (remaining phases in NEEDFIX.md)

- **Phase 4 — Location:** geolocation, distance, nearby sorting
- **Phase 5 — UX:** notifications hub, job detail page, loading/error polish

---

# Phase 3 — Trust ✅

### Runner approval
- `profiles.is_approved` column. New runners need admin approval before they appear in Browse.
- Existing runners were backfilled as approved (no one disappears).
- Unapproved runners get an "Awaiting approval" banner on their dashboard and can't go "available".
- `accept_job()` / `claim_broadcast()` / `set_availability()` enforce approval server-side.

> **Current state:** the DB was wiped (factory reset) after the backfill ran, so the
> backfill no longer matters — **every new runner now starts unapproved** and the admin
> must approve them manually at `/admin` → Runners → **Approve**.

### Suspension
- `profiles.is_suspended` column. Suspended accounts can't create requests, accept/claim jobs,
  or go available.
- Suspended runners are hidden from Browse and from landing counts.

### Reports
- New `reports` table (reason + details + optional job).
- `submit_report()` RPC — server-side guard against self-reports and spam (max 5 open).
- Runner profiles have a **🚩 Report** button with reason picker (Fake runner, No response,
  Abusive behaviour, Fraud/scam, Wrong service, Inappropriate content, Other).

### Blocking
- New `blocks` table (unique blocker/blocked pair, owner-managed via RLS).
- Runner profiles have a **🚫 Block runner** toggle.
- Blocked runners are hidden from Browse, and `create_request()` refuses requests between
  blocked users in either direction.

### Admin panel (real data)
- `/admin` is admin-only (checks `profiles.is_admin`; page shows a hint + your user id + the
  one-liner SQL to promote yourself).
- Tabs: **Runners** (approve / unapprove / suspend / reinstate), **Jobs** (recent 100 with
  status), **Reports** (open reports → resolve / dismiss).
- Admin functions are security-definer with an admin-role check.

# Phase 5 — UX ✅

### Notifications hub
- New `notifications` table; a DB trigger records lifecycle events:
  New request / New broadcast / Accepted / Completed / Expired / Cancelled / Declined.
- `/notifications` page lists them with relative timestamps, linking to the job.
- Nav bar shows a live **unread badge** (polled + on focus); visiting the hub marks all read.

### Job detail page
- `/job/[id]` — full details (route, items, notes, status, created time, contact name).
- Gated 💬 WhatsApp, Accept/Decline/Mark-done for runners, Cancel (tap-again confirm) and
  inline ★ rating + Request-again for the requester.
- Dashboard + history job titles now link to the detail page.

### Loading & error polish
- New shared `LoadingState` skeleton used on Browse, runner profile, settings, admin, notifications.
- Two-tap confirm on cancel actions; server error messages surface in ⚠️ toasts.

### History tabs
- History page now has **All / Completed / Cancelled / Expired** filter tabs.

---

## Files changed in Phases 3 & 5

- `supabase/migrations/20260813_phase3_trust_phase5_ux.sql` — **new** (run once in Supabase)
- `lib/types.ts` — `AppNotification`, `ReportRow`, `AdminRunnerRow`, `AdminJobRow`
- `lib/queries.ts` — notifications / reports / blocks / admin helpers; `fetchRunners` filters
  approved + blocked; `fetchJobById`
- `components/LoadingState.tsx` — **new**
- `components/JoinGuideModal.tsx` — **new** (sign-up guide popup, remembers via localStorage)
- `components/TopNav.tsx` — Notifications link + unread badge
- `app/notifications/page.tsx` — **new**
- `app/job/[id]/page.tsx` — **new**
- `app/admin/page.tsx` — **rewritten** with real data
- `app/runner/[id]/page.tsx` — Report + Block controls
- `app/dashboard/page.tsx` — approval banner, job-detail links, confirm-cancel
- `app/history/page.tsx` — status filter tabs
- `app/browse/page.tsx`, `app/settings/page.tsx` — loading skeletons
- `public/service-worker.js` — **network-first** (stale builds never served; fixes ERR_FAILED)
- `app/page.tsx` — sign-up guide modal, runner vs community role hint, WhatsApp validation

---

## ⚠️ After running the new SQL, promote yourself to admin (once)

```sql
update public.profiles set is_admin = true where id = '<YOUR_USER_ID>';
```
(Open `/admin` first if unsure — the page shows your own user id.)
