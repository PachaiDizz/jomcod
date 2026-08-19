# JomCOD — Community Runner Network

Find a community runner nearby for groceries, parcel pickups, bills, and errands.
A real, running PWA — **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**,
with live data from **Supabase** (Auth + Postgres + RLS + Realtime + Edge Functions).

> Live site: **https://jomcod-eta.vercel.app**

---

## Tech stack

- **Next.js 14 (App Router)** — pages, middleware, API route for auth callbacks
- **TypeScript** throughout
- **Tailwind CSS** — custom `ink/paper/orange/teal/yellow` palette
- **Supabase** — Auth (Google + email/password), Postgres with RLS, Realtime,
  pg_cron maintenance jobs, Edge Functions (push + delete-account)
- **PWA** — installable, offline cache-first service worker

## Getting started

Requirements: **Node.js 18.17+** and npm.

```bash
npm install        # install dependencies
npm run dev        # start dev server → http://localhost:3000
```

Set up environment variables (copy `.env.example` to `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

## Scripts

| Command           | Description                       |
| ----------------- | --------------------------------- |
| `npm run dev`     | Start the dev server              |
| `npm run build`   | Production build                  |
| `npm run start`   | Serve the production build        |
| `npm run lint`    | ESLint (`next/core-web-vitals`)   |

## Project structure

```
app/            → pages (landing, browse, runner/[id], request, broadcast,
│                 dashboard, job/[id], history, notifications, admin, about, news)
components/     → shared UI (TopNav, Button, RunnerCard, RequestFields, modals…)
lib/            → Supabase client + queries, i18n (en/bm), version, types
supabase/       → migrations (SQL editor), edge functions
public/         → manifest, service worker, icons
```

## Documentation

- **[PROJECT.md](PROJECT.md)** — architecture, schema, RLS model, product decisions
- **[CHANGELOG.md](CHANGELOG.md)** — versioned releases (bump `APP_VERSION` in
  `lib/version.ts` and add an entry on every release)
- **[OPEN_ISSUES.md](OPEN_ISSUES.md)** — remaining code-review findings by severity
- **[NEEDFIX.md](NEEDFIX.md)** — product direction + improvement plan

## Key rules

- Job state changes run server-side (Postgres functions) — clients never write
  directly to `jobs`.
- Runner "trust flags" (`is_admin` / `is_approved` / `is_suspended`) are locked to
  admins; see `supabase/migrations/20260819_lock_trust_flags.sql`.
- Job totals are computed server-side from the runner's listed pricing.
- Maintenance jobs (`expire_stale_jobs`, `refresh_availability`) run only via pg_cron.
- **pg_cron must stay enabled** in Supabase for expiry + stale-availability.
- Apply new migrations in the Supabase SQL editor; deployed via Vercel on push to
  `main`.
