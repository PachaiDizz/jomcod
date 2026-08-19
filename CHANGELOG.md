# JomCOD Changelog

Every update, fix, and addition ships with a version number. The user-facing
version lives in **`lib/version.ts`** (`APP_VERSION`) and is shown on the About
page and the "What's new" popup.

> **How to release:** bump `APP_VERSION`, add a new `## [x.y.z]` section below,
> then deploy. The "What's new" popup keys off the version, so it reappears to
> users once per release automatically.

---

## [1.1.3] — 2026-08-19

### Changed
- **Runner onboarding locked until approval:** a brand-new (or just-switched)
  runner lands on the dashboard but sees only a "waiting for admin approval"
  lock screen — services, pricing, and schedule editing are blocked until an
  admin approves them. After approval, everything unlocks as before.
- Enforced in the database too: an unapproved runner can't change their
  `services` / `schedule_*` even via the API
  (`20260819_runner_setup_guard.sql`); admins and direct DB edits unaffected.

---

## [1.1.2] — 2026-08-19

### Changed
- **Hardcoded config removed (#7):** the Supabase preconnect origin is now read
  from `NEXT_PUBLIC_SUPABASE_URL`; the client VAPID public key comes from
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (push is simply not offered when missing); the
  `send-push` edge function requires `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`
  env secrets and returns 500 instead of falling back to embedded keys.
- ⚠️ **Deploy requirements:** set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in Vercel and
  `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` on the `send-push` edge function, or
  web push stops working (in-app notifications are unaffected).
- **Web push restored:** the `send-push` edge function was re-deployed under its
  real name (it had been deleted; the old `hyper-api` URL was stale), secrets set
  (`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `PUSH_SECRET`), and the DB trigger
  now points at `/functions/v1/send-push` (`20260819_fix_push_trigger_url.sql`).
- **Delete account fixed for runners:** deleting an account that was the assigned
  runner on a job failed with "Runner of a job cannot be changed" (the auth delete
  cascaded `jobs.runner_id` to NULL and tripped the guard trigger). The guard now
  only blocks runner changes while the old runner's account still exists
  (`20260819_jobs_guard_cascade.sql`). Also fixed the `delete-account` edge
  function passing the `"Bearer "` prefix into `getUser()`.

---

## [1.1.1] — 2026-08-19

### Added
- **Security headers** — CSP, X-Frame-Options DENY, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy via `next.config.js`.
- **ESLint configured** — `eslint` + `eslint-config-next` (`next/core-web-vitals`),
  `.eslintrc.json`, and the `npm run lint` script now works (zero warnings/errors).

### Fixed
- **Privacy:** `get_user_contact()` no longer leaks a user's name to callers with
  no shared job (returns nothing instead). Batch variant `get_user_contacts()`
  applies the same relationship gate.
- **Performance (#6):** dashboard contacts now resolve in ONE batch RPC instead
  of one per job; reviews for completed jobs load in a single query instead of
  one per job; the fallback poll dropped from 8s → 15s.
- **Middleware dead code:** `homeFor()` no longer takes an ignored role arg.

### Changed
- **README rewritten** to reflect the real (Supabase-backed) app and point at
  `PROJECT.md` / `CHANGELOG.md` / `OPEN_ISSUES.md` / `NEEDFIX.md`.

---

## [1.1.0] — 2026-08-19

### Added
- **Role switching** — change your account type between Community ↔ Runner
  anytime from Settings (wrong role on signup? just switch; switching to Runner
  resets to pending admin approval).
- **Delete account** — remove your account + data from Settings.
- **Email sign-up without verification** — register with email + password and
  get in instantly (no inbox confirmation link).
- **"What's new" popup** — versioned release notes shown once per release, with
  the main points bolded; reopenable from the About page.
- **Version number on the About page** — single source of truth in
  `lib/version.ts`.
- **New PWA icon** — cutout JomCOD logo on a transparent background
  (192/512 + favicon), service-worker cache v9.

### Changed
- **Simpler role switch** — Community → Runner is now a direct flip; services,
  pricing, and schedule are set up from the runner dashboard (with reminders
  until you go live).
- **Job totals are server-computed** — the "Total: RM…" is set from the runner's
  listed pricing, so neither party can change the agreed amount. Custom-priced
  services show no total (you agree on WhatsApp).
- **Broadcast board** — only open (pending) broadcasts are listed; claimed or
  expired requests disappear for other runners.
- **Maintenance jobs run on pg_cron only** — no DB writes triggered by page
  visits anymore (landing stats are read-only).

### Fixed
- **Security (critical):** any user could promote themselves to admin, self-approve
  as a runner, or un-suspend their account — trust flags are now locked to admins.
- **Privacy:** cancelled/expired broadcasts (with pickup/delivery addresses) are no
  longer readable by runners; once a runner accepts a request, only you and that
  runner can see the details (others get "Request already taken").
- **Price-total tampering:** requester or runner could rewrite the agreed total.
- **Email signups stuck** behind the confirmation link.

---

## [1.0.0] — 2026-08-16 (launch)

### Added
- **Authentication:** Google sign-in + email/password; onboarding with a role
  selection step before the sign-up form; role-specific Runner & Community guides.
- **Runner discovery:** Browse runners with service / area / availability filters;
  runner profiles with ratings, reviews, and completed jobs.
- **Requests:** direct requests and broadcast requests; accept / decline / claim /
  cancel; automatic expiry after 5 minutes; WhatsApp CTA for coordination.
- **Trust:** reviews + ratings (tied to completed jobs), report user, block user,
  admin approval for runners, and an admin panel (runners, jobs, reports).
- **Notifications:** in-app notifications hub with a nav badge + web push.
- **Job detail page** and a **History page** (all / completed / cancelled / expired).
- **PWA:** install banner with an iOS step-by-step guide; new JomCOD logo and icons.
- **About page** with contact info and the app version.
- **Parcel proof reminder** on the request form and job detail.

### Changed
- Service picker made compact with inline search; merged "Parcel Pickup" +
  "Parcel Drop-off" into one service.
- Landing stats now only count approved, non-suspended runners.
- Admin stat grid is responsive on mobile; admin access moved to Settings.

### Fixed
- "Request already taken" on direct requests now uses the right action.
- iOS input auto-zoom (16px inputs); price input clearing no longer shows RM0.
- Stored "RM0X" totals normalized everywhere.
- Runners can't go live without at least one priced service (with reminders).
- Broadcast notifications no longer leak delivery addresses or receiver info.

### Performance
- Lazy-loaded QR code; cache-first service worker (v8); preconnect to Supabase;
  trimmed font weights.
