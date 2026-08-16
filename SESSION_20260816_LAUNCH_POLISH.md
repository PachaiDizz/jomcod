# JomCOD — Session Log: Launch Polish + Performance (Aug 16, 2026, part 2)

> Live site: **https://jomcod-eta.vercel.app**
> Deploys: `npx vercel --prod --yes --scope pachai-dizz1`
> Always verify with a hard refresh (**Ctrl+Shift+R**) so the service worker loads fresh.

---

## 1. 🎨 PWA icons — final wordmark design

**2026-08-16 13:20 / 13:53** — Settled on the brand icon:
- Solid ink tile (`#1C2321`), flat, no gradients/shadows.
- Big bold orange **COD** (Space Grotesk Bold — the exact brand font, embedded).
- Small gray **Jom** above it.
- Orange brand dot top-right.
- Rendered at 1024px then downscaled for `icon-512.png`, `icon-192.png`, and
  `app/icon.png` (browser-tab favicon).
- Removed stray test artifacts.

> Installed PWAs keep the old icon until **removed & re-added** to the home screen.

## 2. 📲 Install banner — platform-correct behavior

**2026-08-16 13:27 / 13:35 / 13:53** — Final behavior:
- **Android/Chrome:** no banner at all — the browser already shows its own native
  install button. (Fixed a bug where early `prompt()` consumed the install event and
  made the button a no-op.)
- **iOS only:** banner appears → "Install app" opens a **step-by-step guide**
  (Share button → Add to Home Screen → Add). Apple blocks programmatic install, and the
  JS share sheet does NOT include "Add to Home Screen", so we walk users through it.
- Once installed, a permanent `jomcod_installed` flag suppresses the banner forever —
  even when the site is later opened in a normal browser tab.

## 3. 🇲🇾 BM language fixes

**2026-08-16 14:02** — "ambilan" → **"pengambilan bungkusan"** everywhere; landing status
labels → 🟢 **Tersedia** / 🟠 **Sedang bertugas** / ⚪ **Tidak tersedia hari ini**.

## 4. 🛠 Admin panel

**2026-08-16 15:00** — Stat boxes now `grid-cols-2 md:grid-cols-4` (2×2 on mobile, no more
overlapping text). Removed the About entry from Settings; Admin lives in Settings only.

## 5. 📸 Parcel proof reminder

**2026-08-16 15:23** — Added a reminder (EN/BM) telling the community to send the courier's
proof photo (tracking / receiver details) to the runner over WhatsApp after acceptance, so
the runner can show it to the courier to release the parcel.
- Shown in the request form (parcel services) and on the job detail page when confirmed/done.
- Fixed a latent bug: the merged "Parcel Pickup / Drop-off" name contains "drop", which
  wrongly excluded it from parcel courier fields.

## 6. 🏃 Runner onboarding guard — must list services & pricing

**2026-08-16 15:58 / 16:01** — Runners can't go live without a priced service:
- Reminder note on onboarding (runner role) and on the dashboard services section.
- **"Go available" is blocked** if no service has a name + price (flat/per-item amount or a
  custom description) — shows an alert + warning banner until one is saved.

## 7. 💰 Price formatting & inputs

**2026-08-16 16:08 / 16:23** — 
- Legacy "RM03" style totals now normalize to **RM3** everywhere (dashboard, history, job
  detail, admin).
- Price input: clearing the field no longer snaps to `RM0` (empty input → no price, so
  typing "4" gives RM4, never "04").

## 8. 🗂 ServicePicker — compact dropdown

**2026-08-16 16:08 / 16:12 / 16:15** — Replaced the huge native `<select>` (which opened an
un-dismissible full-screen list on mobile) with a **compact scrollable dropdown**:
- Max-height 150px, tight rows, closes on outside tap / Escape / selection.
- Used on the runner services editor + request form (main + extra services).
- Final version is the simple list (search box removed per feedback).

## 9. 📱 iOS input zoom fixed

**2026-08-16 16:29** — iOS Safari auto-zooms the page when focusing a field under 16px.
Forced `font-size: 16px !important` on inputs/selects/textareas on mobile only (desktop
keeps compact sizes).

## 10. ✅ Request form UX

**2026-08-16 16:43** —
- Clear validation errors: "Please fill in the pickup details — where should the runner
  pick up from?" (was the confusing generic "Please fill in pickup and delivery details").
- Items box labeled without "(optional)" per request; preselect the runner's first service
  when opening a direct request from their profile.

## 11. 🐛 Fix "request already taken" on direct requests

**2026-08-16 16:50** — When a community direct request arrived, the runner's dashboard toast
"Accept" button called the broadcast **claim** function (which requires `runner_id IS NULL`).
Since a direct request already has the runner assigned, it failed with "already taken".
The toast now calls **Accept** for direct requests and **Claim** only for broadcasts.

## 12. ⏱ Countdown auto-disappears on acceptance

**2026-08-16 17:00** — On the community side, the "waiting… mm:ss" countdown now listens for
the job status change and **auto-hides** the moment the runner accepts/claims:
- Direct request → ✅ "{name} accepted your request!" card.
- Broadcast → ✅ "A runner claimed your request!" card.
- Also: guide gained a note — the community can only see the services a runner lists, so
  runners must add every service they offer with its price.

## 13. ⚡ Performance pass

**2026-08-16 17:20** —
- **Lazy-loaded the `qrcode` library** (was bundled into the landing page's first load).
- **Cache-first for hashed static assets** (`_next/static`) in the service worker (v8) —
  repeat visits load JS/CSS/fonts from cache instantly; HTML stays network-first.
- **Preconnect to Supabase** in the head (skips DNS/TLS handshake on API calls).
- **Trimmed font weights** (Inter 400/500/600) to cut font downloads.

---

## Current State (Latest)

- **Live:** https://jomcod-eta.vercel.app
- **QR PNGs** in `~/Downloads`: `JomCOD-QR.png`, `JomCOD-QR-paper.png`
- **Admin access:** only your account (`is_admin = true`) — entry in Settings
- **Database:** reset for public launch; only your account remains
- **Icon:** ink tile + orange "COD" + gray "Jom" + brand dot
- **Install:** Android = native button; iOS = step-by-step guide banner

## Extra Notes

- **Supabase URL** is hardcoded for preconnect in `app/layout.tsx` — update if the project
  ever changes.
- **Service worker:** cache-first for `_next/static`; bump `CACHE_NAME` on big changes.

---

*Log compiled from `git log` history — timestamps in local time (Asia/Kuala_Lumpur).*
