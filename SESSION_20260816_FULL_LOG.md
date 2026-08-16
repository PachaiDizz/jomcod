# JomCOD — Full Build Log (A–Z)

> Live site: **https://jomcod-eta.vercel.app**
> QR share link: `https://jomcod-eta.vercel.app`
>
> Deploys: `npx vercel --prod --yes --scope pachai-dizz1`
> Always verify with a hard refresh (**Ctrl+Shift+R**) so the service worker loads fresh.
> Installed PWAs cache the old icon — remove & re-add to home screen to see new ones.

---

## The Journey — Everything We Did, In Order

### A. Foundation — Phase 1–3 & 5 (Security, Reliability, Trust, UX)

**2026-08-13 10:56** — Core build landed: security (RLS + server-side functions),
reliability (job state machine, guards), trust (admin approval, reports, blocks), and UX.

**2026-08-13 11:59** — Fixed onboarding role race (refresh session before redirect).

**2026-08-13 12:22** — Onboarding now surfaces errors instead of failing silently.

### B. Signup & Community Guide

**2026-08-13 12:43** — Added mandatory community guide + area notice before joining.

**2026-08-13 14:29** — Clarified runner vs community role choice on signup.

**2026-08-13 14:37** — **Service worker**: network-first so fresh deploys always load
(fixed the ERR_FAILED blank page after sign-out).

**2026-08-13 14:47** — Full community guide shown as accept-first modal, remembered via
localStorage.

**2026-08-13 15:04** — Landing hero cleaned: dropped courier list, just "parcel pickups".

**2026-08-13 15:07** — Added 📋 Guide button (signed-in) to re-read the community note.

**2026-08-13 15:38** — WhatsApp validation accepts 11-digit MY numbers
(011-XXXX-XXXX, prefixes 010–019).

**2026-08-13 18:52** — Guide: bolded the JomCOD mentions in the before-you-join note.

**2026-08-13 19:01** — Signup slimmed: dropped full-name field, area dropdown, slimmer time picker.

**2026-08-13 19:05** — Delivery-address fields hidden from runners on signup.

**2026-08-13 20:06** — Onboarding verifies role saved, surfaces errors, hard-navs to
dashboard (fixed the stuck loop).

### C. UX Overhaul — Services, Pricing, Items, Requests

**2026-08-13 21:17** — **UX overhaul**: title-case services, clean pricing, multi-service
requests, item cost calculator, structured delivery fields, restyled
toasts/notifications/history.

**2026-08-13 21:25** — Stripped legacy courier names (JNT/SPX/GDEX) from stored services;
runner's active job shows item breakdown.

**2026-08-13 21:57** — Courier pickup rows match form style; courier names blocked in custom
service names.

**2026-08-13 22:04** — Legacy courier text cleaned from runner services on load so preset
selects match.

**2026-08-13 22:10** — Runner sees item list on new-request toast and open broadcast cards.

**2026-08-13 22:15** — Request items as plain white inputs to match the form.

**2026-08-13 22:32** — **Calculator auto-uses the runner's service price** (item count ×
per-item / flat rate); dropped the item RM column.

### D. Item List & Calculator Fixes

**2026-08-14 05:52** — Fixed calculator showing RM0 (uses effective selected service);
previously-ordered items shown on community dashboard cards and history.

**2026-08-14 06:19** — Item list saved into job notes even when the service dropdown is
untouched (effective service type) — runner now sees what to buy.

**2026-08-14 06:31** — **Numbered item list component** across current job, recent jobs,
broadcast cards, toast, and job detail.

### E. Runner Stats & Polish

**2026-08-14 14:18** — Runner stats & auto-availability: Est. earned sums saved job Total
(with service-price fallback); runner auto-onlines in schedule window (8 AM–5 PM) and
auto-offlines after.

**2026-08-14 14:31** — Bold section headers across dashboards, browse, broadcast, runner
profile, settings.

**2026-08-14 14:48** — Headers tuned to black ink + lighter weight for cleaner contrast.

### F. Mobile & Broadcast UX

**2026-08-14 18:26** — Mobile fixes: bottom-sheet TimePicker with +/− steppers, responsive
3-col grids; broadcast RLS so runners can open/claim broadcasts from notifications
(fixed "Job not found" + empty board); price total written when a runner claims (both sides
see it); normalized legacy RM03 prices.

**2026-08-14 19:08** — Broadcast UX: parcel courier qty counted in pricing (all services
show total), open-board cards + pricing box restyled to match modern job cards, dropped
the "Contact runner" step.

### G. Push, Privacy & Redesign

**2026-08-15 20:53** — **Web push notifications** + broadcast privacy + clean shared job
displays.

**2026-08-15 20:53** — Mobile UI fixes + categorized service list with rename migration.

**2026-08-15 20:53** — **Dashboard "summary then detail" redesign** + History/job detail
polish.

### H. Bilingual (EN/BM) i18n

**2026-08-16 09:33** — **i18n system**: EN/BM language toggle with auto-detect + persisted
choice; mobile nav wrap so Sign Out stays on-screen.

**2026-08-16 10:03** — Combined **Parcel Pickup + Parcel Drop-off** into one
"Parcel Pickup / Drop-off" service (+ data migration).

**2026-08-16 10:16** — Service names, pricing models, and notifications translated to BM;
fixed admin "terhad".

**2026-08-16 10:27** — Runner dashboard heading now shows time greeting + name; BM "what
help" question reworded.

### I. Sharing & PWA Install

**2026-08-16 11:01** — **Landing page**: QR share card, mobile PWA install banner
(iOS-aware), prominent EN/BM toggle.

**2026-08-16 11:10** — QR card: native share-link button (share sheet / clipboard copy).

**2026-08-16 12:26** — Admin nav link + enriched admin data; **PWA auto-install** +
standalone detection (no banner when already installed); dropped the redundant landing
lang toggle; persistent signup guide; added data reset script.

### J. About Page & Icons

**2026-08-16 12:42** — **About page** (EN/BM) with WhatsApp contact links
(+6011-16266163); nav link + Settings entries for About and Admin.

**2026-08-16 12:45** — PWA icons redesigned: ink tile, bold J, orange brand dot.

**2026-08-16 12:49** — **PWA icons v2**: delivery scooter mark with brand dot.

---

## Current State (Latest)

- **Live:** https://jomcod-eta.vercel.app
- **QR PNGs** in `~/Downloads`: `JomCOD-QR.png`, `JomCOD-QR-paper.png`
- **Admin access:** only your account (`is_admin = true`) — Admin button in nav + Settings
- **Database:** reset for public launch; only your account remains

## Extra Notes

- **BM/EN toggle:** in the top nav on every page (EN/BM pill).
- **PWA install:** auto-prompts on Android/Chrome; iOS must use Share → "Add to Home
  Screen" (Apple blocks programmatic install).
- **Service worker:** network-first; bump `CACHE_NAME` in `public/service-worker.js` on big
  changes.

---

*Log compiled from `git log` history — timestamps in local time (Asia/Kuala_Lumpur).*
