# JomCOD — Session Log: UX Overhaul Round (Aug 13, 2026)

> Everything changed in this working session, so we can recheck each item.
> Live site: **https://jomcod-eta.vercel.app** (NOT `jomcod.vercel.app` — that's the
> abandoned old deployment on the 2nd GitHub account).

---

## 1. Community Guide — bold JomCOD
- All standalone **JomCOD** mentions in the "Before you join" modal
  (`components/JoinGuideModal.tsx`) are now bold.

## 2. Signup / Registration form
- **Full name field removed** — signup only asks for Username (shown to neighbours).
- **Area / Neighbourhood is now a dropdown** — `Felda Desa Kencana` / `Felda Wilayah Sahabat`
  (same choices as Google-signup onboarding).
- **"Your delivery address (optional)…" + Sahabat / No. Rumah / Block** only show when the
  role is **Community** — hidden on the Runner side.
- **Time picker slimmed twice** — compact AM/PM toggles + sliders + Set button.
- All of the above apply to `app/page.tsx` (email signup) only.

## 3. Runner side — services & pricing
- **Service names are title-cased** (`saveServices` → `titleCase`).
- **"(JNT / SPX / GDEX)" removed** from Parcel Pickup everywhere.
  - `SERVICE_PRESETS[0]` is now just `"Parcel Pickup"`.
  - Legacy DB names cleaned on load + persisted back (`cleanServiceName` on dashboard load).
  - Applied to: request dropdown, runner cards (Browse), runner profile, job titles.
- **Courier names blocked in custom services** — JNT/SPX/GDEX/Ninja Van/etc. auto-stripped
  from "Other (Write It Myself)" with a hint under the field.
- **Pricing display clean** — `RM04` / `RM4.00` → **`RM4`** via new `formatRM()` helper
  (used in request, profile, cards, dashboard).
- **Settings** — Sahabat / No. Rumah / Block hidden for runners (community-only).

## 4. Item cost calculator (auto total)
- **Items are now just Item + Qty** — the RM column is gone.
- **Total is auto-detected from the RUNNER's service pricing**, not the items:
  - `Per item` → total item count × price per item (e.g. 6 items × RM4 = **RM24**)
  - `Flat rate` → the flat fee (RM8 stays RM8)
  - `Custom` → skipped (can't auto-calc)
- Community sees a green **"You'll pay the runner RM24"** box that updates live.
- Total is saved into the job notes (`Total: RM24`) so the **runner sees the same
  "Community pays RM24"** on their dashboard / current job / job detail page.

## 5. Community side — Request (Direct Request)
- **Delivery Details are structured**:
  - Delivery Area
  - Sahabat (e.g. `05`)
  - No. Rumah (No R) (e.g. `203`)
  - Unit Number (e.g. `3A`)
  - Block (e.g. `04`)
  - Receiver Name / Receiver Phone (optional)
- Combined address becomes: `Sahabat 05 · No R 203 · Unit 3A · Block 04`.
- Prefilled from the community member's saved profile.
- **Multiple services with ONE runner** — "＋ Add another service" button adds extra service
  lines (e.g. Parcel Pickup + Grocery Run in a single request to the same runner).
- **Parcel Pickup pickup details** styled the same as the rest of the form (plain white
  inputs, no courier names in the service name).

## 6. Runner side — seeing what the customer ordered
- Item/service list now shows for the runner in **every** view:
  - 🔔 **New-request toast** — 🛒 item list (name × qty · price)
  - **Open requests board** (broadcast cards) — item chips before claiming
  - **Current job** card — "What to buy / pick up" list + "Community pays RM…"
  - **Recent jobs** — item chips + total
  - **Job detail page** — services, items, total

## 7. Styling / UX restyle
- **Notification toasts** (New Request / broadcast / accepted / done / expired / claimed /
  too-late / error) — redesigned with an icon tile + colored edge bar + clean white card.
- **Notifications page** — cards now have an emoji tile + colored edge, hover lift.
- **History page** — restyled to match the modern job-card look (status header band, route
  line, emoji icon, links to job detail).

---

## How to verify (test checklist)

### Runner
1. Sign in as a runner → dashboard shows **Current job** card with items when a request arrives.
2. Services & pricing → refresh: service names should be title-cased, no `(JNT/SPX/GDEX)`.
3. Settings → no Sahabat / No. Rumah / Block boxes.
4. Pricing shows `RM4` not `RM04`.

### Community
1. Signup (email) → only Username, Area dropdown, no Full name.
2. Direct Request → Delivery Details shows the 5 structured fields; items show Item+Qty only.
3. Add another service → same runner can do Parcel + Groceries in one request.
4. Calculator → "You'll pay the runner RM24" auto-updates with item count × runner price.

---

## Gotchas
- **Old test jobs** created before the calculator/structured-address changes keep their old
  notes format — make a **new request** to see items + total.
- Use `jomcod-eta.vercel.app`, not the old `jomcod.vercel.app` URL.
- Hard-refresh (**Ctrl+Shift+R**) after each deploy so the network-first service worker
  loads the fresh build.
