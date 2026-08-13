# JomCOD — Session Log: Item List & Calculator Fixes (Aug 14, 2026)

> Live site: **https://jomcod-eta.vercel.app** (NOT `jomcod.vercel.app` — that's the
> abandoned old deployment on the 2nd GitHub account).
>
> Deploys are done via `npx vercel --prod --yes` + `npx vercel cache purge --yes`
> (GitHub push alone does NOT reliably redeploy). Verify each change with a hard
> refresh (**Ctrl+Shift+R**) so the service worker loads the fresh build.

---

## 1. 🔴 Fixed — "You'll pay the runner RM 0" (calculator not auto-adding)

- **Root cause:** when the request page opened with just `?runner=xxx` (no `service`
  param), `details.serviceType` stayed `""`. The dropdown *looks* like it's on the
  first option, but the estimate read the raw `details.serviceType` (empty) →
  `pricingFor("")` → `undefined` → total stuck at **RM0** even after adding items.
- **Fix:** compute against the *effective* selected service (falls back to
  `serviceOptions[0]`, the visible default):
  - `components/RequestFields.tsx` — `grandTotal` now uses `{ ...details, serviceType: selected }`.
  - `app/request/page.tsx` — `estimate` (used for the saved `Total:` line) uses the
    effective service too.

## 2. 🔴 Fixed — Runner had no idea what to buy (items never saved)

- **Root cause:** `buildNotes()` checked `isItemListService(details.serviceType)`.
  Same empty-string trap — `isItemListService("")` → `false` → the `Items: …` line
  was **never written** into the job notes. Only `Total:` got saved, which is why RM
  showed but the item list didn't.
- **Fix:** pass the effective service type into `buildNotes` on send:
  - `app/request/page.tsx`
  - `app/broadcast/page.tsx` (same bug)
- **No SQL / Supabase editor change needed** — items live in the job `notes` text.

## 3. ✨ Added — previous orders now visible on BOTH sides

- **Community dashboard** "Your requests" cards — new green **"Items ordered"** box +
  "You pay the runner RM…".
- **History page** (both roles) — each past job card now shows "Items ordered" +
  total via new `parseHistoryNotes()`.
- Job detail page already showed items (chips).

## 4. ✨ Runner side — numbered item list (ItemList component)

- New shared component **`components/ItemList.tsx`** — 🛒 "What to buy / pick up"
  rendered as a **numbered shopping list**: teal circle number badge, item name,
  **×qty** pill + price per line.
- Replaces the old chips/plain lines everywhere a runner sees a job:
  - Runner dashboard **Current job** card
  - **Recent jobs** cards
  - **Open broadcast** cards ("Items requested")
  - **New-request toast** (compact numbered list)
  - **Job detail** page (`/job/[id]`)
- Community side keeps its "Items ordered" box style (looked good already).

---

## Gotchas / notes
- **Old test jobs** created before these fixes keep old/empty notes — make a
  **new request** to see items + total.
- The deployed chunk hashes can differ from a local build (webpack module IDs,
  env vars) — compare the `buildId` in the deployed HTML, not chunk filenames.
- If an edge-cached old build shows up, run `npx vercel cache purge --yes`.
- Custom-priced services (`pricing.model === "custom"`) can't be auto-calculated —
  the total box stays hidden for those by design.
