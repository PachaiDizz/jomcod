# JomCOD — Community Runner Network

Real, running app — built with **Next.js 14 (App Router)**, **TypeScript**, and **Tailwind CSS**.
Data is live from **Supabase** (Auth + Postgres + Realtime) — no fake data.

## 1. Requirements

- **Node.js 18.17 or newer** — check with `node -v`. If you don't have it, download from
  [nodejs.org](https://nodejs.org) (LTS version).
- **VS Code** (you already have this)

## 2. Setup

Open this folder in VS Code, then open a terminal (`Terminal → New Terminal`) and run:

```bash
npm install
```

This downloads all the packages listed in `package.json` into a `node_modules` folder
(this folder is intentionally not included — always generated fresh via `npm install`).

## 3. Run it

```bash
npm run dev
```

Then open **http://localhost:3000** in your browser. You should see the Landing page,
and can click through: Sign up → Browse → Runner Profile → Request/Broadcast →
Dashboard → Admin (visit `/admin` directly in the URL bar for now — no link to it yet
since it's meant to be your private page).

Changes you make to any file under `app/` or `components/` will hot-reload instantly
in the browser as you save.

## 4. Project structure

```
jomrunner-app/
├── app/
│   ├── layout.tsx          → root layout: fonts, top nav, PWA setup
│   ├── page.tsx             → Landing page (Sign in / Sign up)
│   ├── globals.css          → Tailwind + shared custom styles
│   ├── browse/page.tsx      → Browse runners list
│   ├── runner/[id]/page.tsx → Runner public profile (dynamic route)
│   ├── request/page.tsx     → Direct request + 5-min countdown
│   ├── broadcast/page.tsx   → Broadcast request to all available runners
│   ├── dashboard/page.tsx   → Runner's own dashboard
│   └── admin/page.tsx       → Admin panel (approvals, flags, tracker)
├── components/
│   ├── TopNav.tsx           → header with logo + clock
│   ├── InstallPrompt.tsx    → "Install app" PWA button
│   ├── StatusPill.tsx       → 🟢🟡🚗🔴 status badge
│   ├── RunnerCard.tsx       → runner card used in Browse
│   ├── Button.tsx           → shared button styles
│   └── PhoneFrame.tsx       → the rounded "card" wrapper around each screen
├── lib/
│   ├── types.ts             → shared TypeScript types (Runner, Service, etc.)
│   └── mockData.ts          → stand-in "database" — 4 sample runners
├── public/
│   ├── manifest.json        → PWA manifest (installable to home screen)
│   ├── service-worker.js    → offline caching + install support
│   ├── icon-192.png / icon-512.png → placeholder app icons
├── tailwind.config.ts        → custom color palette (ink/paper/orange/teal/yellow)
├── package.json
└── .env.example              → placeholder for future Supabase keys
```

## 5. What's real vs. what's mock

**Real / working:**
- Full navigation between every screen
- Sign up role picker (Community / Runner)
- 5-minute countdown timers on both Direct Request and Broadcast (actual `setInterval`,
  not just a static number)
- Broadcast demo auto-resolves at the 45-second mark so you can see the "someone
  accepted" state without waiting the full 5 minutes
- Runner status selector (4 states) on the dashboard
- Installable as a PWA (once deployed to HTTPS — see below)

**Still mock (no backend yet):**
- Sign in / Sign up don't actually create accounts — they just navigate you to the next
  screen
- Runner list, jobs, reviews, stats are all hardcoded in `lib/mockData.ts`
- "Approve/Reject" buttons on Admin don't change any real data
- WhatsApp button uses a real `wa.me` link format, but with placeholder numbers

## 6. Next steps (when you're ready)

1. **Connect a real database** — Supabase is the easiest fit (free tier, handles auth +
   database + storage together). You'd replace the functions in `lib/mockData.ts` with
   real Supabase queries.
2. **Real authentication** — Supabase Auth (phone OTP or email/password) instead of the
   current "just navigate" sign in/up.
3. **Real-time broadcast** — needs a backend function (Supabase Edge Function or similar)
   to notify multiple runners and resolve "first to accept wins."
4. **Deploy** — push this project to GitHub, then connect it to
   [Vercel](https://vercel.com) (made by the same team as Next.js — zero config needed).
   This also gives you free HTTPS, which is required for the "Install app" button to work
   for real visitors.

## 7. Testing the PWA install locally

The install prompt only fires on HTTPS (or `localhost`, which is allowed for testing).
Run `npm run dev`, open `http://localhost:3000` in Chrome, and you may see the install
button appear in the bottom-right corner once the service worker registers. On a real
phone, this only works after deploying to a real HTTPS domain (e.g. Vercel).
