# JomCOD — Need Fix / Improvement Plan

> This document tracks the important issues, improvements, and production-readiness work that should be addressed in the current JomCOD WIP.
>
> JomCOD is a **community runner network**, not a payment marketplace. The purpose is to help community members find an available local runner for small errands and coordinate the task together. Payment processing is outside the scope of this web app.

---

## 1. Product Direction

### Core concept

**Community member needs help → finds an available runner → sends request → runner accepts → both coordinate through WhatsApp → task is completed → community member can rate the runner.**

JomCOD should focus on:

- Finding available local runners
- Matching runners with suitable services
- Simple request and acceptance workflow
- Community trust
- Availability status
- Local coordination
- WhatsApp communication

### Explicitly Out of Scope

Do **not** add unnecessary payment infrastructure unless the product direction changes.

- No payment gateway
- No wallet
- No platform payment processing
- No payout system
- No commission system
- No in-app transaction settlement

If runners and community members arrange payment between themselves, JomCOD does not need to process or store that payment.

---

# 2. 🔴 CRITICAL — Security & Privacy

## 2.1 Review `profiles` RLS

Current profile policy allows profiles to be publicly readable.

Review whether all fields need to be exposed publicly.

Potentially sensitive fields include:

- WhatsApp number
- Full name
- Schedule
- Area
- Services
- Status

### Recommended direction

Public runner profile should expose only information necessary for discovery.

Consider separating:

**Public information**
- Username
- Display name
- Runner status
- Area
- Services
- Rating
- Completed jobs

**Private information**
- WhatsApp number
- Account-related information
- Internal/admin fields
- Other personal data

WhatsApp should ideally become visible only when appropriate, such as after a request is accepted.

---

## 2.2 Review `jobs` UPDATE RLS

Current job update policy is participant-based.

A participant can potentially update the job, but not every participant should necessarily be allowed to modify every field.

Review which fields each role is allowed to change.

Example:

### Community can:
- Create request
- Cancel request while pending
- View their request
- Rate runner after completion

### Runner can:
- Accept request
- Decline request
- Mark accepted job as done

### Users should NOT freely modify:
- Requester ID
- Runner ID
- Job ownership
- Completion history
- Rating ownership
- Other security-sensitive fields

Prefer server-side/Postgres functions for important state transitions.

---

## 2.3 Review `claim_broadcast()`

The atomic first-to-accept mechanism is good and should remain.

Verify:

- Only authenticated users can call it
- Only valid runners can claim
- A runner cannot claim their own broadcast
- A completed/expired job cannot be claimed
- A runner cannot claim multiple conflicting jobs if business rules prohibit it
- The function cannot be abused through direct RPC calls

Keep the atomic database operation because this protects against two runners accepting the same broadcast simultaneously.

---

## 2.4 `SECURITY DEFINER` audit

Any `SECURITY DEFINER` function must be carefully reviewed.

Verify:

- `search_path` is controlled
- Permissions are restricted
- Input is validated
- Users cannot use the function to access unrelated data
- Functions do not expose privileged operations

---

# 3. 🔴 CRITICAL — Runner Availability

Availability is one of the most important parts of JomCOD.

Current runner statuses:

- Available
- Busy
- Delivery
- Offline

The system should clearly define what each status means.

### Recommended rules

**Available**
> Runner is currently willing to receive requests.

**Busy**
> Runner is temporarily unavailable for another request.

**Delivery**
> Runner is currently handling a job.

**Offline**
> Runner does not want to receive requests.

---

## 3.1 Prevent stale "Available" status

A major issue to solve:

> What happens if someone marks themselves Available and then closes the browser?

The system could incorrectly show them as available for hours.

Consider adding:

- `last_seen_at`
- `availability_updated_at`

Then automatically consider a runner unavailable if their availability becomes stale.

Example:

```text
Available
Last active: 2 minutes ago
```

Instead of simply:

```text
Available
```

---

## 3.2 Runner availability heartbeat

Potential future improvement:

```text
Runner opens dashboard
        ↓
System records activity
        ↓
last_seen_at updated
        ↓
Runner remains Available
        ↓
Runner closes/leaves app
        ↓
Heartbeat expires
        ↓
Runner becomes Offline
```

Do not make this unnecessarily aggressive. The exact timeout should be tested with real users.

---

# 4. 🔴 CRITICAL — Job Lifecycle

Define the job lifecycle clearly.

Recommended:

```text
PENDING
   ↓
CONFIRMED
   ↓
DONE
```

Alternative exits:

```text
PENDING → EXPIRED
PENDING → CANCELLED

CONFIRMED → CANCELLED
CONFIRMED → DONE
```

Current project has:

- pending
- confirmed
- done
- expired

Consider adding `cancelled`.

---

## 4.1 Community cancellation

Community should be able to cancel a pending request.

Example:

```text
Request sent
     ↓
Runner has not accepted
     ↓
Community cancels
     ↓
CANCELLED
```

---

## 4.2 Runner decline

Runner should be able to decline a direct request.

Do not leave the request in a confusing pending state.

---

## 4.3 Prevent invalid state transitions

The application should prevent things like:

```text
DONE → PENDING
EXPIRED → CONFIRMED
CANCELLED → DONE
```

State transitions should be validated server-side, not only in the frontend.

---

# 5. 🔴 CRITICAL — Automatic Job Expiry

Current expiry is partly client-side.

The UI can hide old jobs, but the database row can remain `pending`.

This should eventually be handled server-side.

Example:

```text
Broadcast created
     ↓
5 minutes
     ↓
No runner accepted
     ↓
Database automatically changes:
pending → expired
```

This prevents stale jobs from accumulating.

---

# 6. 🟠 HIGH — WhatsApp Privacy

WhatsApp is intentionally the communication layer.

That is good for the current product direction.

However, avoid exposing runner WhatsApp numbers unnecessarily.

Recommended flow:

```text
Community
   ↓
Browse runner
   ↓
Send request
   ↓
Runner accepts
   ↓
WhatsApp button becomes available
   ↓
Community + Runner communicate
```

The WhatsApp CTA should preferably appear only when the relationship/request allows it.

---

# 7. 🟠 HIGH — Runner Trust

Because JomCOD connects strangers in a community, trust is important.

Consider:

- Runner rating
- Completed jobs
- Number of successful jobs
- Runner profile
- Area
- Services
- Availability
- Report user
- Block user
- Admin moderation

Avoid allowing ratings before a genuine completed job.

A review should always be connected to the corresponding completed job.

---

# 8. 🟠 HIGH — Admin System

The current admin page is still mostly empty.

A future admin system should support:

### Runner management

- View runners
- Approve runner
- Suspend runner
- Disable runner
- View runner activity

### User management

- View users
- Suspend abusive users
- Review reports

### Job moderation

- View active jobs
- View completed jobs
- Investigate reported jobs

### Reports

Potential report reasons:

- Fake runner
- No response
- Abusive behaviour
- Fraud/scam
- Wrong service
- Inappropriate content
- Other

---

# 9. 🟠 HIGH — Location / Nearby Runners

Current system uses an `area` field.

That is fine for the MVP.

However, the product concept is fundamentally local:

> "Who's available near me?"

Future version should consider actual geographic proximity.

Potential implementation:

```text
User location
     ↓
Runner coordinates
     ↓
Calculate distance
     ↓
Sort nearest available runners first
```

Possible UI:

```text
🟢 Available now
DumbDizz 69
Sahabat 05
📍 1.2 km away
```

Do not expose precise home coordinates publicly.

Use approximate location or controlled distance calculations.

---

# 10. 🟠 HIGH — Browse Experience

The Browse page should prioritize:

1. Available now
2. Nearby
3. Relevant service
4. Good response/reliability history
5. Rating
6. Price, if runners choose to display one

Example:

```text
AVAILABLE NOW

🟢 Runner A
📍 Sahabat 05
📦 Parcel Pickup
⭐ 4.9
✓ 38 jobs completed

[View Runner]
```

The key decision should be:

> "Can this person help me right now?"

---

# 11. 🟡 MEDIUM — Runner Profile

Runner profiles could eventually include:

- Profile photo
- Username
- Area
- Current availability
- Services
- Rating
- Jobs completed
- Recent reviews
- Typical availability
- Approximate distance

Avoid exposing unnecessary personal information.

---

# 12. 🟡 MEDIUM — Notifications Hub

Current realtime alerts are useful, but they disappear after the toast.

Future:

```text
Notifications

🔔 New request
5 minutes ago

✅ Runner accepted your request
12 minutes ago

🎉 Request completed
Yesterday
```

This gives users a history of important events.

---

# 13. 🟡 MEDIUM — Job Detail Page

Add a dedicated job detail page.

Example:

```text
JOB #JMC-1024

Service
Parcel Pickup

Take From
J&T Sahabat

Deliver To
Sahabat 05

Status
Confirmed

Runner
DumbDizz 69

Created
12 Aug 2026, 1:20 PM

[Chat on WhatsApp]
[Cancel Request]
```

For completed jobs:

```text
Completed
12 Aug 2026, 2:10 PM

[Rate Runner]
```

---

# 14. 🟡 MEDIUM — WhatsApp Validation

Validate Malaysian WhatsApp numbers before generating links.

Accept common formats such as:

```text
01XXXXXXXX
+601XXXXXXXX
```

Normalize internally to:

```text
+601XXXXXXXX
```

Then generate the WhatsApp link consistently.

---

# 15. 🟡 MEDIUM — Database Indexes

As the number of users/jobs grows, add indexes for frequently queried fields.

Potential indexes:

```text
jobs.requester_id
jobs.runner_id
jobs.status
jobs.created_at
profiles.role
profiles.status
profiles.area
```

Do this based on actual query patterns rather than adding indexes blindly.

---

# 16. 🟡 MEDIUM — Production Monitoring

Before public launch:

- Error logging
- Supabase database monitoring
- Authentication monitoring
- Failed request tracking
- Realtime connection monitoring
- Server/API error handling
- Basic abuse/rate-limit protection

---

# 17. 🟡 MEDIUM — Rate Limiting / Abuse Protection

Important because the system allows users to create requests.

Prevent:

- Spam requests
- Repeated broadcast creation
- Request flooding
- Fake reviews
- Automated account creation
- Repeated RPC calls

Possible limits:

```text
Maximum active requests per user
Maximum broadcasts per time period
Maximum review attempts
```

The exact limits should be decided after testing real usage.

---

# 18. 🟢 LOW — UI Polish

Current UI is already fairly mature.

Future improvements can include:

- Empty-state illustrations
- Better loading skeletons
- More polished notifications
- Better mobile navigation
- Confirmation dialogs for destructive actions
- Better error messages
- Offline/reconnect states

These should come after the core security and business logic.

---

# 19. Remove / Reconsider

## Runner "Estimated Earned"

Current project calculates estimated earnings from completed jobs × service price.

If JomCOD does **not** process payments, this metric may be misleading.

Consider replacing it with:

```text
Jobs Completed
```

or:

```text
Successful Requests
```

or:

```text
Community Helps
```

If runners independently arrange payment with community members, JomCOD should make that distinction clear.

---

# 20. Recommended MVP Definition

Before calling JomCOD MVP-ready, I would want:

### Authentication
- [x] Google login
- [x] Email/password
- [x] Onboarding
- [x] Role selection

### Runner discovery
- [x] Browse runners
- [x] Search
- [x] Service filter
- [x] Area filter
- [x] Availability filter
- [ ] Better nearby logic

### Requests
- [x] Direct request
- [x] Broadcast request
- [x] Runner accept
- [x] Runner decline
- [x] Mark completed
- [x] Cancel request
- [x] Automatic expiry
- [x] Strict server-side state transitions

### Communication
- [x] WhatsApp CTA
- [x] Better WhatsApp privacy/visibility rules

### Trust
- [x] Reviews
- [x] Rating
- [x] Report user
- [x] Admin moderation
- [x] Runner approval

### Security
- [x] Full RLS audit
- [x] Profile privacy audit
- [x] Job UPDATE policy hardening
- [x] SECURITY DEFINER audit
- [x] Rate limiting / abuse protection

### Production
- [ ] Vercel deployment
- [ ] HTTPS
- [ ] PWA testing on real phones
- [ ] Monitoring
- [ ] Database backup/recovery plan

---

# 21. Priority Order

Do not build everything at once.

Recommended order:

## Phase 1 — Security

1. ~~Audit `profiles` RLS~~ ✅ done — private by default, public `runner_profiles_public` view
2. ~~Audit `jobs` RLS~~ ✅ done — SELECT only; state changes via functions
3. ~~Audit `reviews` RLS~~ ✅ done — rating via `add_review()` (done job + requester + once)
4. ~~Audit `claim_broadcast()`~~ ✅ done — role check, not own broadcast, no stale, one active job
5. ~~Audit all `SECURITY DEFINER` functions~~ ✅ done — all set `search_path`, restricted grants, validated inputs
6. ~~Protect sensitive profile information~~ ✅ done — WhatsApp + home address never public

## Phase 2 — Core reliability

7. ~~Proper job state machine~~ ✅ done — `cancelled` added + DB guard trigger
8. ~~Cancellation~~ ✅ done — community cancel + runner decline → `cancelled`
9. ~~Server-side expiry~~ ✅ done — `expire_stale_jobs()` (pg_cron + on load)
10. ~~Runner availability freshness~~ ✅ done — heartbeat + auto-offline stale "available"
11. ~~Prevent duplicate/spam requests~~ ✅ done — `create_request()` guards (5 max, no dupes, 1 broadcast)
12. ~~Validate WhatsApp numbers~~ ✅ done — `normalizeWhatsApp()` / `isValidWhatsApp()`

## Phase 3 — Trust

13. ~~Runner approval~~ ✅ done — `is_approved` + admin approve/unapprove
14. ~~Reports~~ ✅ done — `reports` table + `submit_report()` + runner profile Report button
15. ~~User blocking/suspension~~ ✅ done — `blocks` + `is_suspended`; enforced in functions + Browse
16. ~~Admin dashboard~~ ✅ done — `/admin` (runners, jobs, reports) behind `is_admin`
17. ~~Better runner history~~ ✅ done — History page tabs (All/Completed/Cancelled/Expired)

## Phase 4 — Location

18. Approximate geolocation
19. Distance calculation
20. Nearby runner sorting
21. Better local discovery

## Phase 5 — UX

22. ~~Notifications hub~~ ✅ done — `notifications` table + trigger + `/notifications` + nav badge
23. ~~Job detail page~~ ✅ done — `/job/[id]` with WhatsApp, actions, rating, request-again
24. ~~Better loading/error states~~ ✅ done — shared skeleton, confirm-cancel, ⚠️ toasts
25. Final mobile/PWA polish (mostly pending — needs live-device testing after deploy)

---

# 22. Final Product Principle

JomCOD should stay simple.

The core value is **not payment**.

The core value is:

> **"I need something done nearby. Who is available to help me?"**

Everything in the product should reinforce that.

A good JomCOD experience should feel like:

```text
I need help
     ↓
Find available runner
     ↓
Choose the right person
     ↓
Send request
     ↓
Runner accepts
     ↓
Connect on WhatsApp
     ↓
Task completed
     ↓
Rate
```

If that loop is fast, trustworthy, and reliable, JomCOD has a strong foundation.
