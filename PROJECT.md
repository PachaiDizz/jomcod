# JomCOD — Project Status & Documentation

> Built together step by step. This file tracks **what we did, what's working, and what's next**.
> Keep it updated as we keep building.

---

## 1. What this app is

**JomCOD** — a community runner network. People in a neighbourhood (Malaysia) can find a nearby
runner to do small errands: grocery runs, parcel pickups (JNT / SPX / GDEX), and other tasks.
Community members request → a runner accepts → they chat on WhatsApp → the job gets done → the
community member rates the runner.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Auth + Postgres + Realtime)

---

## 2. What's DONE (working now)

### Setup & Auth
- ✅ Supabase project connected via `.env.local` (`NEXT_PUBLIC_SUPABASE_URL` + anon key)
- ✅ **Google sign in / sign up** (OAuth) — works without email verification
- ✅ Email + password sign in / sign up (email confirmation ON — sends verification email)
- ✅ **Onboarding page** (`/onboarding`) — Google users pick **Community or Runner**, add WhatsApp + area
- ✅ Middleware route protection — not logged in → sent to landing
- ✅ **Role-based routing** — runner → `/dashboard`, community → `/browse`, no role yet → `/onboarding`
- ✅ Top nav: **Browse / Dashboard (with pending-jobs badge) / History / News / Settings / Sign out**
  (sticky website header with active-link highlighting on desktop)

### Database (Supabase)
- ✅ `profiles` table — one row per user (name, whatsapp, area, role, status, schedule, services)
- ✅ `jobs` table — requests & broadcasts (requester, runner, service, pickup/drop, notes, status)
- ✅ `reviews` table — ratings left by community on completed jobs
- ✅ **RLS policies** — profiles publicly readable, each user writes only their own row; jobs visible to participants + runners can read open broadcasts; reviews publicly readable, reviewer writes own
- ✅ **Trigger** — every new signup auto-creates their profile row
- ✅ **Backfill** — script that created profile rows for accounts that existed before the trigger

### Real, live features (no fake data)
- ✅ Browse lists **real runners** from the `profiles` table
- ✅ Runner public profile loads from DB — status, services, **real reviews + average rating**
- ✅ **Direct request** form saves a real `job` (5-min countdown on the requester side)
- ✅ **Broadcast** form saves a real job → runners see it on the "Open requests" board and can
  claim it (first-to-accept wins)
- ✅ **Runner dashboard**: status / schedule / services all **save to the DB**; incoming jobs show
  with **Accept / Decline / Mark as done**
- ✅ **Realtime notifications** (Supabase Realtime):
  - Runner gets an instant 🔔 "New request!" alert (orange, pulsing) when a job arrives
  - Community gets **"✅ Runner accepted!"** alert + **💬 Chat on WhatsApp** button
  - Community gets **"🎉 Request completed!"** alert → **rating card** (1–5★ + comment)
  - Nav bar shows a pending-job **badge** for runners
- ✅ Community dashboard = **"My requests"** tracker with statuses, WhatsApp CTA, and rating

### Data hygiene
- ✅ All fake/hardcoded data removed → honest **empty states** everywhere
  ("No runners nearby yet", "No jobs yet", "No applications yet", etc.)
- ✅ Landing hero stats now show `0` instead of made-up numbers

### UX upgrades (round 2)
- ✅ **Time sliders (AM/PM)** for runner availability schedule — no manual typing
- ✅ **Service presets** for runners (parcel pickup, groceries, pay bills, etc.) with
  "Other — write it myself" option; pricing inputs now show `RM` prefix
- ✅ **Structured Deliver To** — Sahabat / No. rumah / Signboard (or receiver name) on
  request + broadcast forms
- ✅ **Shared service type choices** on request + broadcast (community side)
- ✅ **Usernames** — signup + onboarding ask for a username; shown instead of email names
  (`alter table` already applied — see §4 profiles)
- ✅ **History page** (`/history`) — completed/expired jobs for both roles
- ✅ **News page** (`/news`) — live Google News feed (Malaysia) with graceful fallback

### Desktop redesign (round 3)
- ✅ **Real website header** — sticky nav with active states: Browse / Dashboard (pending badge) /
  History / News / Settings + Sign out
- ✅ **Responsive layout** — phone-style column only on small screens; pages expand to full width
  on desktop (Browse 2-col grid, Dashboard 2-col, History/News 2-col, runner profile 2-col)
- ✅ **Landing page** — two-column desktop layout (hero left, sign-in right)
- ✅ **Browse stats strip** — runners / available now / have pricing counts; working search
  (name, area, service) + available-now filter
- ✅ **Community dashboard stats** — total / completed / in-progress counts
- ✅ **Settings page** (`/settings`) — edit username, full name, WhatsApp, area, status, and
  schedule; shows email + role

### Broadcast → runners (round 4)
- ✅ **Open requests board** on the runner dashboard — live broadcast jobs with "⚡ Claim this job"
- ✅ **📣 New broadcast alert** — instant orange toast on arrival
- ✅ **First-to-accept wins** — `claim_broadcast()` Postgres function atomically claims a job
  (race-safe; two runners can't both win; the loser gets a "⏱️ Just missed it" toast)
- ✅ **RLS policy** — runners can read open broadcasts (`runner_id is null and status = 'pending'`)
- ✅ **8s poll fallback** — board stays in sync even if realtime drops a claim/expiry event
- ✅ Broadcast board auto-hides jobs older than 5 minutes; broadcast page now shows all network
  runners instead of a fake slice of 3

### Desktop makeover (round 5) — real responsive layouts, not a scaled-up phone
- ✅ **Rebrand → JomCOD** — logo, browser tab, manifest (PWA name), sign in/up, onboarding,
  browse/news copy all renamed from JomRunner
- ✅ **`PhoneFrame` width logic** — now takes `wide` / `narrow` props:
  - `narrow` (Request / Broadcast / Onboarding) → `max-w-[420px] md:max-w-xl`, comfortable
    reading width on desktop, not full-bleed
  - `wide` (Admin) → fills the container
  - default (Browse / Dashboard / Profile / History / News) → phone card on mobile,
    full width on desktop (`max-w-[420px] md:max-w-none`)
- ✅ **Real desktop top nav** — Browse / Dashboard / History / News / Settings in their own
  bordered row on `md:`+, active page = dark `bg-ink` pill; mobile keeps the wrapped chip row
- ✅ **Browse** — sticky left filter sidebar (`md:grid-cols-[260px_1fr]`) with search, status
  toggle, **service checkboxes**, **area checkboxes**, and a **max-price slider** (all derived
  live from real runners); runner cards in a `md:grid-cols-2 lg:grid-cols-3` grid. Advanced
  filters are hidden on mobile — mobile looks exactly like the phone prototype
- ✅ **Runner profile** — `md:grid-cols-[1fr_360px]`: main column (stats, services, reviews in a
  2-col grid) + **sticky right sidebar** with WhatsApp / Request buttons and quick facts
  (area, status, schedule) that stays visible on scroll
- ✅ **Runner dashboard** — status / schedule / stats on the **left**, recent jobs + services &
  pricing on the **right**, side by side (`md:grid-cols-2`); open-requests board stays full-width
  on top
- ✅ **Role indicator** — a "🏠 Community" / "🛵 Runner" badge shows in the top nav on every page
  and next to the "Your dashboard" heading, so users always know which side they're on
- ✅ **Card overflow fixes** — `flex-shrink-0` / `min-w-0` on cards and pills; runner names use
  `break-words` on a full-width row (status pill moved beside the area) so long usernames wrap
  cleanly instead of being cut off or stacking vertically

### Runner card design polish (round 6)
- ✅ **Compact card** — slim padding (`p-3`), 40px avatar, trimmed name/price sizes, tight
  internal margins so the Browse grid feels dense, not chunky
- ✅ **Colored avatar badge** — muted per-runner palette (teal, orange, mustard, deep blue, olive,
  terracotta) instead of near-black; assigned deterministically by name
- ✅ **Orange price pill** — `RM8/trip` sits in a soft-orange rounded badge as the key decision point
- ✅ **Tinted stat boxes** — Rating (soft yellow), Jobs done (soft teal), Distance/Accept (soft gray)
  in a single side-by-side row; empty states show a muted **dashed** box ("★ New", "0", "—")
  so they read as "not yet available", with a "No reviews yet" tooltip on the rating
- ✅ **Yellow ★ always** — even in the "New" empty state, the star stays yellow
- ✅ **Service: block** — teal service chips under a "Service:" label; shows *"No services listed
  yet"* when a runner hasn't set any, so the card flexes for any data
- ✅ **Colored left-edge status strip** — 4px strip in the runner's status color
  (green = available, yellow = busy, orange = on delivery, gray = offline); card border stays neutral
- ✅ **Bold area text** — neighbourhoods like "Sahabat 05" show in semibold under the name

### Request form redesign (round 7)
- ✅ **Labeled pickup/delivery fields** — every input now has a clear label: Pickup Details →
  `Pickup Location:`, Delivery Details → `Delivery Area:` / `No. House, Lot, Unit Number:` /
  `Receiver Name:` / `Receiver Phone (Optional):`
- ✅ **No pickup contact** — removed the pickup-contact field entirely; the community doesn't fill
  in who to call at pickup (runner handles it)
- ✅ **Parcel Pickup = multi-courier list** — instead of a typed pickup location, users split their
  parcels across couriers with "+ Add another courier" rows: pick a courier (JNT, SPX Express,
  Ninja Van, Pos Laju, Flash, GDEX, DHL, Best Express) + item count each. Saved as e.g.
  `JNT ×1 item, SPX Express ×2 items, GDEX ×1 item`
- ✅ **Food Pickup uses item list** — same "Add Items / Qty" rows as Grocery Run
- ✅ **No "Write your own service"** — picking `Other` no longer asks for a custom name; it just
  saves as "Other Errand" (details go in the Items / Request Details box)
- ✅ **Clean placeholders** — removed `e.g. Pakya Enterprise`, `e.g. Sahabat 05`, `e.g. Wakmin`,
  `01X-XXXXXXX`; replaced with basic "Enter …" hints
- Applies to both the **Direct request** (`/request`) and **Broadcast** (`/broadcast`) forms via the
  shared `components/RequestFields.tsx`

### Landing page live stats (round 8)
- ✅ **Real numbers, not zeros** — the hero now shows live counts: active runners, jobs this month,
  and avg rating (from real reviews)
- ✅ **Status legend with live counts** — Available now / Busy on a job / Off for the day each show
  the current runner count by `profiles.status` (busy = `busy` + `delivery`, off = `offline`)
- ✅ **Auto-refresh** — stats re-fetch every 10s so the landing page updates in real time
- ✅ **Graceful fallback** — if the `get_landing_stats()` RPC isn't in the DB yet, it computes what
  it can from `profiles` + `reviews` (jobs count reads `0`); see §4 for the SQL to run once

### Onboarding, runner dashboard & request form (round 9)
- ✅ **Onboarding: area dropdown** — Area / Neighbourhood is now a select with the two supported
  areas: **Felda Desa Kencana** and **Felda Wilayah Sahabat** (shared `AREA_OPTIONS` in
  `lib/constants.ts`)- ✅ **Onboarding: runner vs community fields** — Sahabat / No. Rumah / Block + the "prefilled when
  you request" hint only show for **Community**; runners just get role + WhatsApp + area + schedule
- ✅ **Onboarding: clean placeholders** — no more `e.g. …` hints; plain "Enter …" text
- ✅ **Runner dashboard: Recent Jobs redesign** — status-tinted header band (emoji + service title +
  status pill), a route line (🟢 pickup `→` delivery 🟠), 2×2 detail tiles (Pickup / Delivery /
  Received by / Needed by), items as teal chips, notes, and Accept / Decline / Mark-as-done actions
- ✅ **Runner dashboard: view community ratings** — completed jobs have a **"★ View rating from …"**
  pill that expands to show stars (X/5), reviewer name and their message (compliment or criticism);
  "No rating yet" until the community rates
- ✅ **Request form: runner-specific services** — on a direct request, the Service Type dropdown now
  shows **only the chosen runner's services** (not every service type); falls back to defaults only
  when a runner has none. Broadcast still lists all types
- ✅ **Keyword-based service detection** — so runner presets still trigger the right UI:
  parcel-but-not-drop-off → courier list ("Parcel Pickup (JNT / SPX / GDEX)" yes, "Drop-Off Parcel"
  no); grocery / food / buy / shop → Add-Items list ("Food Takeaway Pickup" included)

> **Mobile testing gotcha (dev only):** Safari/Chrome block the OAuth redirect back to an insecure
> `http://192.168.1.10:3000`, so Google sign-in fails on phones even with the redirect URL
> whitelisted. Options: use **email + password** on the phone, add the LAN IP to Supabase Redirect
> URLs, or run a **local HTTPS proxy** (self-signed CA installed on the phone) / Cloudflare tunnel so
> the whole chain is `https`.

### Security & reliability hardening (round 10) — Phase 1 + Phase 2 of NEEDFIX.md
> ⚠️ **Requires one-time SQL**: run `supabase/migrations/20260813_phase1_security_phase2_reliability.sql`
> in the Supabase SQL editor (end with `--done`) before testing. The app now depends on the new
> Postgres functions / view — until it's run, jobs can't be created and Browse lists no runners.

- ✅ **Profile privacy** — `profiles` is now only readable by its owner; public discovery goes
  through the new `runner_profiles_public` view (username, name, role, status, area, services,
  schedule, last seen, completed-job count). **WhatsApp + home address are never public.**
- ✅ **WhatsApp is gated** — `get_user_contact()` only returns a number once the two users share an
  accepted/completed job (requester unlocks the runner's number on accept; an assigned runner can
  reach the requester immediately). Runner profile + dashboards only show the 💬 button when allowed.
- ✅ **Jobs RLS hardened** — direct INSERT/UPDATE on `jobs` is removed. All job lifecycle goes through
  server-side functions: `create_request()`, `accept_job()`, `decline_job()`, `mark_job_done()`,
  `cancel_job()`, `claim_broadcast()`, `expire_stale_jobs()`.
- ✅ **Server-side state machine** — new `cancelled` status; a `jobs_status_guard` trigger rejects
  invalid transitions (`done→pending`, etc.) and ownership edits even if the app is bypassed.
- ✅ **Spam/duplicate guards** in `create_request()` — max 5 active requests, no duplicate pending
  request to the same runner+service, one active broadcast at a time, can't request yourself.
- ✅ **One active job per runner** — `accept_job()` / `claim_broadcast()` reject a second confirmed
  job; the UI surfaces the server message in a ⚠️ toast.
- ✅ **Community cancellation** — pending/confirmed requests can be cancelled from "My requests";
  declined direct requests now go to `cancelled` (not `expired`).
- ✅ **Reviews hardened** — ratings go through `add_review()` which only allows the requester of a
  genuinely `done` job, once (unique `job_id`).
- ✅ **Automatic expiry** — `expire_stale_jobs()` marks 5-min-old pending broadcasts `expired` in the
  DB (pg_cron every minute + on dashboard load). No more client-only hiding.
- ✅ **Availability freshness** — new `last_seen_at` / `availability_updated_at` columns; the runner's
  open dashboard heartbeats every 30s; `refresh_availability()` auto-offlines stale "available"
  runners (5-min timeout, pg_cron + on browse/dashboard/landing). Browse shows "🟢 active Xm ago".
- ✅ **WhatsApp validation** — `normalizeWhatsApp()`/`isValidWhatsApp()` normalise MY numbers
  (`012-3456789` → `+60123456789`) on signup, onboarding and settings; invalid numbers are rejected
  with a friendly message; `waLink()` builds robust wa.me links.
- ✅ **Indexes** — added for `jobs.requester_id/runner_id/status/created_at`,
  `profiles.role/status/area/last_seen_at`, `reviews.runner_id`.

### Feature map — what each side has

**🏠 Community side**
- Browse real runners + filters (search, service, area, max price, available-now)
- Runner public profile — stats, services, reviews, WhatsApp, Request service
- Direct request to one runner (5-min countdown)
- Broadcast to all runners (first-to-accept wins)
- "My requests" tracker — statuses, 💬 WhatsApp CTA, ★ rating card on completion
- History (completed/expired jobs), News feed, Settings
- "🏠 Community" role badge on every page + dashboard header

**🛵 Runner side**
- Dashboard — status, schedule, services & pricing (all save to DB)
- Open requests board — claim broadcasts (first-to-accept, atomic)
- Accept / Decline / Mark as done on assigned jobs
- Realtime alerts — 🔔 new request, 📣 new broadcast, 🎉 you got the job, ⏱️ just missed it
- Pending-job badge in the nav
- Runner stats — real avg rating, jobs count, est. earned (done jobs × service price)
- History, News, Settings + "🛵 Runner" role badge

**Shared**
- Top nav with Browse / Dashboard / History / News / Settings (dark pill active state)
- Role badge everywhere, responsive desktop layout (mobile = phone-style, unchanged)
- Supabase Realtime, honest empty states (no fake data), full-width desktop grids

---

## 3. Project structure

```
├── app/
│   ├── layout.tsx            → fonts, top nav, PWA
│   ├── page.tsx              → landing: Google + email sign in/up
│   ├── onboarding/page.tsx   → role picker for Google users
│   ├── auth/callback/route.ts→ OAuth / email-verify callback (routes by role)
│   ├── browse/page.tsx       → real runner list
│   ├── runner/[id]/page.tsx  → public profile + real reviews
│   ├── request/page.tsx      → direct request (saves job)
│   ├── broadcast/page.tsx    → broadcast (saves job)
│   ├── dashboard/page.tsx    → runner OR community dashboard (realtime)
│   ├── history/page.tsx      → past jobs (done/expired) for both roles
│   ├── news/page.tsx         → live community news feed
│   ├── settings/page.tsx     → profile (username, name, whatsapp, area) + availability
│   └── admin/page.tsx        → admin panel (real data)
├── components/  TopNav, RoleBadge, Button, PhoneFrame, RunnerCard, StatusPill, InstallPrompt, TimePicker, JoinGuideModal, LoadingState
├── lib/
│   ├── constants.ts          → SERVICE_PRESETS (shared service choices)
│   ├── types.ts              → Runner, Service, JobRequest, Review, Pricing
│   ├── queries.ts            → all Supabase data functions
│   ├── supabase/{client,server}.ts
│   └── mockData.ts           → now EMPTY (helpers only, pricingLabel/pricingDisplay)
├── middleware.ts             → auth guard + onboarding + role routing
└── .env.local                → Supabase URL + anon key
```

---

## 3.5 Live deployment (Vercel)

**Live site:** https://jomcod-eta.vercel.app

> The old `jomcod.vercel.app` deployment was on the 2nd GitHub account and is
> **no longer used**. The live project now points at the **main account** repo
> (`PachaiDizz/jomcod`) so Vercel's commit-author check passes.

### Deployment facts
- **Host:** Vercel (Hobby plan), auto-deploy from `main` on push
- **Repo (deploy source):** `https://github.com/PachaiDizz/jomcod`
- **Env vars in Vercel:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **To redeploy:** just `git push origin main` — Vercel builds automatically
- **Domains:** production `jomcod-eta.vercel.app` (+ per-build preview URLs that can be ignored)

### One-time config (already done)
- **Supabase → Auth → URL Configuration → Redirect URLs:** `https://jomcod-eta.vercel.app/**`
- **Google Cloud Console → Credentials → Web client:**
  - Authorized redirect URI: `https://vjanzunjalhrghikqzsy.supabase.co/auth/v1/callback`
  - Authorized JavaScript origins: `https://jomcod-eta.vercel.app`

### If the site won't load / ERR_FAILED after a deploy
- The PWA service worker was made **network-first** (`public/service-worker.js`, `v2`)
  so stale builds are never served. After a big deploy, do **one hard-refresh**
  (**Ctrl+Shift+R**) to install the new worker — normal navigation works after that.

### Sign-up guide modal
- `components/JoinGuideModal.tsx` — full "before you join" note (community purpose,
  serving areas, how it works, safety reminders) shown as a **popup before sign-up**.
- Remembered via `localStorage` (`jomcod_guide_ok`) so it only shows once per device.
- Also removed the old inline note + checkbox from the signup form.

---

## 4. Database schema (SQL reference)

All of these have been run successfully. Safe to re-run (the `--done` at the end stops the SQL
editor from auto-adding `limit 100` and breaking the query).

### profiles
```sql
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  username text,
  whatsapp text,
  area text,
  role text check (role in ('community','runner')),
  status text check (status in ('available','busy','delivery','offline')) default 'offline',
  services jsonb default '[]',
  schedule_from text,
  schedule_to text,
  created_at timestamptz default now()
);
```

> **Existing DBs** (username feature): run this once —
> `alter table public.profiles add column if not exists username text; --done`
>
> **Existing DBs** (home address feature — Sahabat / No. Rumah / Block): run this once —
> ```sql
> alter table public.profiles add column if not exists sahabat text;
> alter table public.profiles add column if not exists no_rumah text;
> alter table public.profiles add column if not exists block text;
> --done
> ```
>
> **Existing DBs** (runner schedule — ⚠️ the live `profiles` table was missing these): run once —
> ```sql
> alter table public.profiles add column if not exists schedule_from text;
> alter table public.profiles add column if not exists schedule_to text;
> --done
> ```

### jobs
```sql
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references auth.users(id) on delete cascade,
  runner_id uuid references auth.users(id) on delete set null,
  service_type text,
  take_from text,
  deliver_to text,
  notes text,
  status text default 'pending' check (status in ('pending','confirmed','done','expired')),
  created_at timestamptz default now()
);
```

### reviews
```sql
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade unique,
  runner_id uuid references auth.users(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete cascade,
  author_name text,
  rating int check (rating between 1 and 5),
  text text default '',
  created_at timestamptz default now()
);
```

### RLS policies (applied to the tables above)
```sql
-- profiles
alter table public.profiles enable row level security;
create policy "profiles are viewable by everyone" on public.profiles
  for select using (true);
create policy "users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- jobs
alter table public.jobs enable row level security;
create policy "jobs readable by participants" on public.jobs
  for select using (auth.uid() = requester_id or auth.uid() = runner_id);
create policy "users can create jobs" on public.jobs
  for insert with check (auth.uid() = requester_id);
create policy "participants can update jobs" on public.jobs
  for update using (auth.uid() = requester_id or auth.uid() = runner_id);

-- Broadcast board: runners may READ open (unassigned, pending) jobs only.
-- Claiming is done through claim_broadcast() (security definer, atomic).
create policy "runners can read open broadcasts" on public.jobs
  for select using (auth.uid() is not null and runner_id is null and status = 'pending');

-- reviews
alter table public.reviews enable row level security;
create policy "reviews are viewable by everyone" on public.reviews
  for select using (true);
create policy "reviewers can add their own review" on public.reviews
  for insert with check (auth.uid() = reviewer_id);
create policy "reviewers can update their own review" on public.reviews
  for update using (auth.uid() = reviewer_id);
```

### Trigger — auto-create profile for every new signup
```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### Backfill (only needed once, for accounts created before the trigger)
```sql
insert into public.profiles (id, full_name, role, whatsapp, area, created_at)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
  u.raw_user_meta_data->>'role',
  u.raw_user_meta_data->>'whatsapp',
  u.raw_user_meta_data->>'area',
  u.created_at
from auth.users u
on conflict (id) do nothing; --done
```

### Realtime (must be enabled for live notifications)
```sql
alter publication supabase_realtime add table public.jobs; --done
```

### Broadcast claiming — first-to-accept wins (run once)
```sql
create or replace function public.claim_broadcast(p_job_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_runner_id uuid := auth.uid();
begin
  if v_runner_id is null then
    return false;
  end if;

  -- Only claim if still open (pending + unassigned). Atomic — two runners
  -- calling this simultaneously: only one UPDATE matches, so only one wins.
  update public.jobs
     set runner_id = v_runner_id,
         status = 'confirmed'
   where id = p_job_id
     and runner_id is null
     and status = 'pending';

  return found;
end $$;

grant execute on function public.claim_broadcast(uuid) to authenticated; --done
```

### Landing page live stats — run once in the SQL editor
Anon visitors can read `profiles` and `reviews`, but RLS blocks them from `jobs`, so the
"jobs this month" count needs a `security definer` function. This one returns everything the
landing hero + status legend need in one call:
```sql
create or replace function public.get_landing_stats()
returns json language plpgsql security definer set search_path = public as $$
declare
  v_total int;
  v_available int;
  v_busy int;
  v_off int;
  v_jobs_month int;
  v_avg numeric;
begin
  select count(*) into v_total from public.profiles where role = 'runner';
  select count(*) into v_available from public.profiles where role = 'runner' and status = 'available';
  select count(*) into v_busy from public.profiles where role = 'runner' and status in ('busy','delivery');
  select count(*) into v_off from public.profiles where role = 'runner' and status = 'offline';
  select count(*) into v_jobs_month from public.jobs
    where created_at >= date_trunc('month', now())
      and created_at < date_trunc('month', now()) + interval '1 month';
  select round(avg(rating), 1) into v_avg from public.reviews;
  return json_build_object(
    'active_runners', v_total - v_off,
    'available', v_available,
    'busy', v_busy,
    'off', v_off,
    'jobs_this_month', v_jobs_month,
    'avg_rating', coalesce(v_avg, 0)
  );
end $$;

grant execute on function public.get_landing_stats() to anon, authenticated; --done
```
> If it's not created yet, the app falls back to computing runner statuses + avg rating from the
> publicly readable tables (jobs this month shows `0`), so the landing page never breaks.

---

## 5. Configuration (done, for reference)

### `.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=https://vjanzunjalhrghikqzsy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

### Google Cloud Console (Project: JomCOD)
- OAuth 2.0 Client ID — type **Web application**
- **Authorized redirect URI:** `https://vjanzunjalhrghikqzsy.supabase.co/auth/v1/callback`
- (Optional) Authorized JavaScript origin: `http://localhost:3000`

### Supabase dashboard
- **Authentication → Providers → Google:** enabled, Client ID + Client Secret filled
- **Authentication → URL Configuration → Redirect URLs:** add `http://localhost:3000/**`

> Note: the "Google Client IDs" field on the Google provider page must be left **empty**
> for a web-only app. It's only for extra Android/iOS client IDs.

---

## 6. How to test the full loop (1-by-1)

You need **two browser windows** (one normal + one incognito).

### Direct request flow
1. **Window A (Community):** `http://localhost:3000` → sign in as **Pachai Dizz**
2. **Window B (Runner):** incognito → `http://localhost:3000` → sign in as **DumbDizz 69**
3. In **A**: Browse → open **DumbDizz 69** → Request service → fill locations → **Send request**
4. **Watch B**: the orange **"🔔 New request!"** alert pops instantly → **Accept**
5. Back in **A**: see **"✅ DumbDizz 69 accepted!"** + green **💬 Chat on WhatsApp** button
6. In **B**: the job now says **Confirmed** → **Mark as done**
7. In **A**: get the **"🎉 Request completed!"** alert → tap ★ stars → comment → **Submit rating**
8. In **A**: Browse → **DumbDizz 69** profile → see ★ average rating + the review

### Broadcast flow (first-to-accept wins)
1. **A** (Community): Broadcast → fill locations → **⚡ Broadcast**
2. **Watch B** (Runner): **"📣 New broadcast request!"** toast + job on the **Open requests** board
3. In **B**: **⚡ Claim this job** → **"🎉 You got the job!"**
4. Back in **A**: **"✅ Runner accepted!"** + WhatsApp button appears
5. Optional — open a **third** window as another runner: the job is gone from their board
   (it was claimed); if two runners claim at the same time, only one wins, the other gets
   **"⏱️ Just missed it"**

---

## 7. What's NEXT (pick from here when you're ready)

### Quick wins (small effort, big feel)
| Item | Notes |
|------|-------|
| **Switch role anytime** | A button on the dashboard to flip between Community ↔ Runner in one tap (both roles already supported; just needs a UI toggle that updates `role`). |
| **Runner onboarding details** | Let runners set status/services during signup/onboarding, not just on the dashboard. |
| **Real DB auto-expiry of stale jobs** | Expiry is client-side only right now (board hides stale jobs, but the DB row stays `pending`). Add a scheduled function / edge trigger to set `status='expired'`. |
| **WhatsApp number validation** | Quick sanity check (e.g. starts with `+60` / `01`, digits only) so wa.me links always work. |
| **Empty-state polish** | Cards, dashboard, and history already have honest empty states — could add small illustrations/CTAs. |

### Features worth planning
| Item | Notes |
|------|-------|
| **Admin panel real data** | Still empty states. Needs runner approval flow + flags/reports tables. |
| **Runner profile distance (`distanceKm`)** | Not stored yet — no geolocation. Profile just shows area. Add browser geolocation or manual "approx distance". |
| **Landing community count** | Show how many community members use the network (or a combined "members" count) on the hero — decided to wait until the base grows; reuse `get_landing_stats()`. |
| **Job detail view** | Click a job → full detail page (route, notes, timeline, runner contact). |
| **Notifications hub** | In-app notification list (all past alerts), not just toasts. |
| **Chat inside the app** | For now everything routes to WhatsApp; could add in-app messaging later. |
| **Runner earnings / payouts** | Track real payments, not just "est. earned". |
| **Deploy to production (Vercel)** | Gives free HTTPS → "Install app" PWA works on real phones. |
| **PWA install on real devices** | Works on localhost now; needs HTTPS after deploy. |

### Data / infra notes
| Item | Notes |
|------|-------|
| **DB indexes** | Fine at this scale, but `jobs.runner_id` / `jobs.requester_id` queries benefit from indexes as data grows. |
| **Backups / RLS audit** | Re-check RLS policies after adding any new table (e.g. reports). |

---

## 8. Handy notes / gotchas we hit

- **"Invalid characters. Google Client IDs..."** → the "Google Client IDs" box on the Supabase
  provider page must stay empty for web-only. Real Client ID goes in the **Client ID** box.
- **SQL Editor `limit 100` error** → Supabase appends `limit 100` to your query. Ending the last
  line with `--done` makes it part of a comment so it's ignored. (e.g. `...; --done`)
- **"Success. No rows returned"** → normal for `create table` / `insert` queries. Counts from
  `select` show in the **Results** panel below the editor.
- **Empty Browse = usually a database problem**, not the app:
  1. Did the profile row get created? (backfill / trigger)
  2. Do the RLS read policies exist? (test with the anon key)
- **Sign-out and sign back in** after changing auth/routing code, so the old session cookie
  doesn't override the new logic.
- **"You rated 0★" after submitting** → was a UI bug: the dashboard replaced your review with a
  placeholder `{ rating: 0 }`. Fixed — it now shows the rating you actually submitted. The row was
  always saved to `reviews` correctly.
- **Runner dashboard `—` / `RM0`** → was hardcoded placeholder stats. Now computes real rating from
  `reviews`, job count, and est. earned (done jobs × service price).
- **If live alerts stop arriving** → the `jobs` table probably got dropped from the realtime
  publication when it was recreated. Re-run in the SQL editor:
  `alter publication supabase_realtime add table public.jobs; --done`
  The dashboard now also auto-shows the 🔔 alert on load if there's a pending job, and retries the
  realtime channel on error, so notifications survive disconnects.
- **Broadcast claiming needs two SQL blocks** (not yet run in the DB — see §4):
  1. The `claim_broadcast()` function (atomic first-to-accept-wins)
  2. The `"runners can read open broadcasts"` RLS policy
  Until both are run, the "Open requests" board is empty and claiming won't work.
