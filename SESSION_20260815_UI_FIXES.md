# JomCOD — Session Log: Mobile UI Fixes + Notification Review (Aug 15, 2026)

> Live site: **https://jomcod-eta.vercel.app**
>
> Deploys: `npx vercel --prod --yes --scope pachai-dizz1` — the `--scope` is required;
> plain `npx vercel --prod --yes` fails with **"Not authorized"** on this machine.
> Always verify with a hard refresh (**Ctrl+Shift+R**) so the service worker loads fresh.

---

## 1. 🕐 Time picker (runner schedule From/To) — compact on mobile

**Problem:** the custom wheel-style picker (AM/PM toggle + Hour/Minute sliders) took up
nearly half the phone screen, and the native `<input type="time">` triggered the OS's own
big wheel sheet that can't be styled or resized.

**Fix — `components/TimePicker.tsx` rebuilt:**
- Removed the native `<input type="time">` entirely (was mobile-only).
- One pill button on all sizes (still shows `8:00 AM` + 🕐 clock icon when closed).
- Tapping opens a **compact 280px popover** below the input (fixed-position, clamped to the
  viewport so it never overflows off-screen; never a full-screen sheet).
- **Mobile (< md):** two `<select>` menus side by side (Hour 1–12, Minute 00–55) + a
  stacked AM/PM toggle + a Set button. Teal accent for the selected AM/PM.
- **Desktop (md+):** the original wheel-style picker (sliders + +/- buttons) is unchanged.
- Popover closes on outside tap, scroll, or resize.
- Minute select now includes the saved minute even when it isn't a 5-min step
  (e.g. a typed `8:07 AM` displays and saves correctly).

## 2. 📱 Settings schedule row overflow (mobile)

**Problem:** From/To inputs were pushed past the right edge of their card on mobile.

**Fix — `app/settings/page.tsx`:**
- Row changed to `flex flex-wrap gap-2 min-w-0` so the two pickers shrink or wrap instead
  of overflowing.
- `TimePicker` root + pill button got `min-w-0`; native inputs already use `w-full`.

## 3. 🔔 Notification popup (PushBanner) — left side on desktop

**Problem:** the "Get notified on your phone" banner (and the "🔔 Notifications on" toggle)
sat bottom-right on desktop.

**Fix — `components/PushBanner.tsx`:** `sm:right-auto sm:left-4` on both states. Mobile
still spans full width.

## 4. 📋 "Before you join" guide modal — three rounds

**Round 1 (position + close):** it sat too high and was unreadable. Added a ✕ close button
and a scrollable overlay.

**Round 2 (compact layout rejected):** condensed into cards — user wanted the original
full-length note back, not a compact version. Reverted to the full note.

**Round 3 (the real bug — `components/JoinGuideModal.tsx`):**
- **Root cause:** the modal was rendered inside `<header>` (in `TopNav.tsx`), and the header
  has `backdrop-blur` — a `backdrop-filter` makes `position: fixed` children position
  relative to the **header** instead of the viewport → page content bled through above/below.
- **Fix:** render the modal via **`createPortal` to `document.body`** so `fixed inset-0`
  always covers the whole screen.
- Backdrop layer: `fixed inset-0 z-[70] bg-black/50`. Modal layer: `fixed inset-0 z-[71]
  overflow-y-auto`, content centered with `min-h-full flex items-center justify-center`.
- **Body scroll locked** while open (`document.body.style.overflow = "hidden"`, restored on
  unmount). Works on mobile (covers the status-bar area) and desktop, including over Settings.

## 5. 🔍 Full code review (notifications + previous session's fixes)

Reviewed the whole uncommitted tree from the Aug 14 push session plus today's changes:
migration `20260814_push_notifications.sql`, `20260814_fix_notification_privacy.sql`,
edge function `send-push` (deployed as `hyper-api`), `lib/push.ts`, `service-worker.js`
(cache `v6`), `PushBanner`, `lib/jobFormat.ts`, `RouteInfo`, dashboard/history/job pages.

**Verified good:** build + `tsc` pass; push pipeline intact; privacy policy (no leaked job
rows, `broadcast_taken` has no job link); reactive Est. earned `useMemo` before early
returns; 8s jobs poll + heartbeat; clean RouteInfo displays.

**Fixed after review (minor):**
- `lib/push.ts` — upsert now uses `{ onConflict: "endpoint" }` so re-subscribing on the same
  browser updates the row instead of failing on the `unique(endpoint)` constraint.
- `components/TimePicker.tsx` — minute select includes non-5-min saved values (see §1).
- `app/dashboard/page.tsx` — the 8s poll also reloads contacts (`loadContacts(...)`) so
  toast names appear even when realtime misses an event.

## ⚠️ Security note (not changed, needs a decision)

The VAPID **private** key + `PUSH_SECRET` are embedded in the repo (edge function fallback +
`20260814_push_notifications.sql`). This was a deliberate workaround — dashboard secrets were
not reliably picked up by the running deployment. Removing them risks breaking live push.
Hardening path when wanted: set VAPID keys + `PUSH_SECRET` as function env vars, verify a
redeploy still fires pushes, then delete the embedded fallbacks.

## 6. 🗂️ Service list — categorized + renamed (Runner + Community)

- Added `SERVICE_CATEGORIES` to `lib/constants.ts`; `SERVICE_PRESETS` is now derived from it.
- Dropdowns (runner Dashboard services, community request form + broadcast) show **optgroups**:
  🛒 Shopping & Groceries · 📦 Parcels & Documents · 💳 Bills & Payments · 🍜 Food ·
  🧺 Other Errands.
- **Renamed** the actual stored service names (with matching logic + DB migration):
  `Drop-Off Parcel → Parcel Drop-off`, `Pay Bills (Toll / Water / Electric) → Pay Bills`,
  `Top-Up / Reload Card → Top-Up / Reload`, `Other Errand → Other (specify)`,
  `Laundry Drop-Off / Pickup → Laundry Drop-Off/Pickup`; dropped
  `Buy Groceries For Me` + `Shop Errand` (existing rows → `Other (specify)`, pricing kept).
- **Migration:** `supabase/migrations/20260815_rename_services.sql` — renames values in
  `profiles.services` (JSONB), `jobs.service_type`, job `notes`, and `notifications.body`.
  ✅ run in Supabase.
- Removed the now-dead `"Other" → "Other Errand"` mappings in request/broadcast pages;
  quick-add service buttons updated.

## 7. 🎛️ Dashboard redesign — "summary then detail" (Runner + Community)

The dashboard was duplicating full history. Now it answers "what needs my attention now"
and defers the full list to History:

- **Community — Your requests:** active (pending/confirmed) shown as full detail cards
  (tracking, cancel, WhatsApp); **past requests → 3 most-recent full detail cards** (items,
  "You pay the runner", status, Request again) under a small **Recent** label + "View all →".
- **Runner — Recent jobs:** hero "Current job" keeps the in-progress (OTW/confirmed) job;
  **pending** jobs needing accept/decline stay full cards; **3 most-recent completed jobs
  shown as full detail cards** (pickup/delivery tiles, items, "Community pays" total,
  rating pill). "View all →" to History.
- Card rendering extracted into `renderCommunityCard` / `renderRunnerCard` closures.

## 8. ✨ History + job detail polish

- **History:** added a stat strip (Completed / Earned-or-Spent / Cancelled); cards upgraded
  with an emoji tile header, hover elevation, and a footer (date + "View details →").
- **Job detail:** status-colored accent bar on top, emoji tile header with the
  runner/requester name inline, cleaner "Created" row, more prominent total.
- Centralised `serviceEmoji()` in `lib/constants.ts`; dashboard/history/job now share it.

## File changes this session

- `components/TimePicker.tsx` — rebuilt (compact select popover on mobile, wheel on desktop)
- `components/JoinGuideModal.tsx` — portal to body, backdrop + scroll-lock, ✕ close button
- `components/PushBanner.tsx` — left-side on desktop
- `app/settings/page.tsx` — schedule row `flex-wrap` + `min-w-0`
- `lib/push.ts` — upsert `onConflict: "endpoint"`
- `app/dashboard/page.tsx` — poll also loads contacts; full dashboard redesign (§7)
- `public/service-worker.js` — cache bumped to `v6` (previous session's work, still uncommitted)
- `lib/constants.ts` — `SERVICE_CATEGORIES`, service rename, shared `serviceEmoji()`
- `supabase/migrations/20260815_rename_services.sql` — **new** (run in Supabase)
- `app/request/page.tsx`, `app/broadcast/page.tsx` — drop "Other"→"Other Errand" mapping
- `app/history/page.tsx` — stat strip + card polish (§8)
- `app/job/[id]/page.tsx` — accent bar + header polish (§8)

## Tested & working
- Compact mobile time picker (no OS sheet, no overflow) — desktop wheel unchanged
- Guide modal fully covers the screen on mobile + desktop, scrolls from the top, ✕ closes it
- PushBanner on the left on desktop
- Push notifications untouched and still expected to work (client-only change today)
- Categorized service dropdowns on both sides; old data renamed by migration ✅
- Dashboard shows active + 3 recent full-detail cards on both sides; History + job detail polished

## Still uncommitted (git)
Everything from the Aug 14 push-notifications session + this session's fixes. A commit was
offered but not requested yet.
