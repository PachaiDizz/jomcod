# JomCOD — Session Log: Push Notifications + Broadcast Privacy & Dashboard Cleanup (Aug 14, 2026)

> Live site: **https://jomcod-eta.vercel.app** (NOT `jomcod.vercel.app` — abandoned old
> deployment on the 2nd GitHub account).
>
> Deploys: `npx vercel --prod --yes` (+ `npx vercel cache purge --yes` after big changes).
> Always verify with a hard refresh (**Ctrl+Shift+R**) so the service worker loads fresh.

---

## 1. 🔴 Fixed — Notification privacy leak (broadcast)

**Problem:** Runner B who saw a broadcast could still open the job even after Runner A claimed it —
seeing delivery details, receiver info, the notes, and the "Total: RM…" (Est. earned of Runner A).

**Root cause:** the RLS policy `users can read jobs they were notified about`
(from `20260814_broadcast_visibility.sql`) let any notified runner read the FULL job row
forever, even after it became another runner's private job.

**Fix — `supabase/migrations/20260814_fix_notification_privacy.sql` (run in Supabase):**
- **Dropped** the leaky "notified about" read policy. Claimed/private jobs are only readable
  by participants again.
- Restricted `runners can read open broadcasts` to **approved, non-suspended runners only**
  (was any logged-in user) — broadcasts are no longer readable by community accounts via API.
- `jobs_notify()` now, on claim: deletes each other runner's stale "New broadcast request"
  notification and replaces it with **"Request already taken — This request has already been
  accepted by another runner."** (no details, no job link).
- New `new_broadcast` notification bodies no longer embed the delivery destination/receiver.
- Cleanup statement removes already-leaked broadcast notifications for claimed jobs.

## 2. 🔴 Fixed — Clean request/job displays everywhere

New `lib/jobFormat.ts` (`parseDeliverTo`, `formatTakeFromLines`, `formatDelivery`) + shared
`components/RouteInfo.tsx`.

- **Open Requests board**: Pickup couriers shown **one per line** as `J&T: 1 item`,
  `SPX Express: 3 items` (no `×`, no bold). Delivery shows the address + `Receiver: Name · phone`.
  Parcel request-details notes (`extra`) now show on the board too.
- **Current Job card** (runner): organized labeled rows —
  `Courier/Pickup: …` / `Address: …` / `Receiver Name: …` / `Phone Number: …`.
- **Recent jobs / Your requests / History / Job detail**: same clean block, non-bold values.
- `parseDeliverTo` is now **order-aware**: the last `·`-part is the receiver (even without a
  phone number), and address pieces (No R / Unit / Block) never get mistaken for the receiver.

## 3. 🔴 Fixed — "Received By" showing the block number

**Root cause:** both dashboards sliced `deliverTo.split(" · ")` and assumed index `[2]` was the
receiver — but when `No R`/`Unit`/`Block` were filled, index `[2]` was actually the **Block**.

**Fix:** replaced all slicing with `formatDelivery()` → correct `receiverName` from the proper
field, for every job (not just the first).

## 4. 🔴 Fixed — Est. earned not updating (mobile)

**Root cause:** `runnerEarned` was computed once on page load; realtime updates only called
`setJobs`, never recomputed earned.

**Fix:**
- Earned is now **derived reactively** (`useMemo` over `jobs` + `services`) → `computeEarned()`.
- Runner dashboard **re-syncs assigned jobs every 8s** (alongside the open-board poll), so stats
  update even when Supabase realtime drops on mobile browsers.
- ⚠️ The first attempt placed the `useMemo` AFTER the early `return` statements → conditional
  hook → **React error #310** crash on production. Fixed by moving it up with the other hooks
  (always called, every render).

## 5. ✨ Runner dashboard layout

- **Left column:** Your status → My performance → Est. earned → **Your services & pricing**
- **Right column:** Recent jobs (only)
- Mobile still stacks in that order.

---

## 6. ✨ NEW — Real push notifications (Web Push)

**Before:** notifications only appeared while the app was open (realtime toasts + hub).
**Now:** real OS notifications arrive even when the app is closed / backgrounded.

### How it works
```
job event (INSERT/UPDATE on jobs)
        ↓
jobs_notify() trigger  ──►  in-app notification row (same as before)
        ↓
push_user() (SECURITY DEFINER)  reads PUSH_SECRET from public.app_secrets
        ↓
net.http_post → edge function  (pg_net)
        ↓
edge function verifies x-push-secret, looks up push_subscriptions for the target
        ↓
web-push (VAPID) → OS notification on the phone
```

### Deployed pieces
- **`supabase/migrations/20260814_push_notifications.sql`** — creates `push_subscriptions`
  (per-user push endpoints, owner-managed RLS), `app_secrets` (push secret, no read policies),
  and rewrites `jobs_notify()` to also fire pushes for: new request, new broadcast, accepted,
  done, expired, cancelled, declined, broadcast taken.
- **`supabase/functions/send-push/index.ts`** — the relay. Requires env (see below).
- **`public/service-worker.js`** — added `push` + `notificationclick` handlers. **Cache bumped
  to `v5`.** Also fixed a latent iOS bug: `CORE_ASSETS` no longer includes `/index.html`
  (Vercel redirects it → 307 → iOS `cache.addAll` rejected redirects → service worker never
  activated → `navigator.serviceWorker.ready` hung forever).
- **`lib/push.ts`** — `subscribeToPush()` / `unsubscribeFromPush()` / `isPushEnabled()`;
  VAPID public key embedded (it's public by design) so it works without a Vercel env var.
  Subscription flow has 8–10s timeouts so it can never hang the UI; errors show in the banner.
- **`components/PushBanner.tsx`** — bottom-right banner after sign-in: "Get notified on your
  phone" → Allow / Not now (remembered via `localStorage`). On success becomes a
  "🔔 Notifications on" toggle button. Mounted in `app/layout.tsx`.

### ⚠️ Deployment gotchas hit this session
- The edge function must be deployed under the name **`hyper-api`** on this project (the
  dashboard rename to `send-push` did NOT move the deployed URL). The DB trigger calls
  `https://vjanzunjalhrghikqzsy.supabase.co/functions/v1/hyper-api`.
  → If the function is ever re-created, keep the name `hyper-api` OR update the URL inside
  `20260814_push_notifications.sql` (push_user) to whatever the deployed name is.
- Function "Custom secrets" were **not reliably picked up** by the running deployment (VAPID
  keys kept showing as missing → 500). Solved by **embedding the VAPID keys in the function
  code** with env-var override.
- Testing the function: POST with an `Authorization: Bearer <anon>` header is REQUIRED
  (Supabase gateway rejects missing JWT with 401) — the DB trigger already sends it.
- Working function check: `POST /v1/hyper-api` with anon + `x-push-secret` + `{}` →
  **400 Bad Request** (reachable + secret OK); with a fake `target_user_id` → **200 {"sent":0}**.
- iOS: Web Push only works when the PWA is **installed to the Home Screen** (not just open in
  Safari). iOS Safari's `navigator.serviceWorker.ready` can hang — the client waits on the
  registration's own worker state instead.

### Required env (on the edge function, optional now that keys are embedded)
```
PUSH_SECRET=0c3e0de32186ee128ac02b62cdd08dab2f8aa02dea26df8f   (must match public.app_secrets)
VAPID_PUBLIC_KEY=BLKb3BCfXiAhrtHxohH0mr17C1rm8O6d3bWYcadoZDFDys1X-qfvFrFfWL-NN1etl0WHxtaAj7XLEo7ZHWsEJTc
VAPID_PRIVATE_KEY=BujH04qAIlAWEgqL3NaToKeMaH3djboeU6OuV2Jw3Nk
```

---

## File changes this session

- `supabase/migrations/20260814_fix_notification_privacy.sql` — **new** (run in Supabase)
- `supabase/migrations/20260814_push_notifications.sql` — **new** (run in Supabase)
- `supabase/functions/send-push/index.ts` — **new** (paste into the `hyper-api` edge function)
- `lib/jobFormat.ts` — **new** (parse/format helpers)
- `components/RouteInfo.tsx` — **new** (shared pickup/delivery block)
- `lib/push.ts` — **new** (client push subscribe/save)
- `components/PushBanner.tsx` — **new**
- `app/dashboard/page.tsx` — clean displays, Received By fix, reactive Est. earned + 8s jobs
  poll, services moved to left column, hook-order fix
- `app/job/[id]/page.tsx` — RouteInfo display, non-bold values
- `app/history/page.tsx` — RouteInfo display
- `app/notifications/page.tsx` — `broadcast_taken` style
- `components/RequestFields.tsx` — `parseDeliverTo` moved to `lib/jobFormat` (re-exported)
- `app/layout.tsx` — PushBanner
- `public/service-worker.js` — push/notificationclick + CACHE v5 + `/index.html` removed from
  pre-cache (iOS install fix)
- `tsconfig.json` — exclude `supabase/functions` (Deno, not Next.js)

## Tested & working
- Broadcast privacy: Runner B sees "Request already taken", no details/total of Runner A's job
- Clean stacked courier display, correct Received By, live Est. earned
- **Real push notification received on iPhone (installed PWA) with the app fully closed**
