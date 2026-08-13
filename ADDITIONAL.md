# JomCOD — Additional Features & Product Improvements

> This document contains recommended additions for the **Community side** and **Runner side** of JomCOD.
>
> The goal is to strengthen the core JomCOD concept:
>
> **Community needs help → find an available runner → request → runner accepts → coordinate through WhatsApp → task completed → rate.**
>
> JomCOD is not a payment marketplace. Payment processing is outside the scope of this application.

---

# 1. 🏠 Community Side

## 1.1 Home / "Find Help" Dashboard ⭐⭐⭐

Create a proper Community home/dashboard instead of making Browse the only starting point.

Example:

```text
Good afternoon, Pachai 👋

What do you need help with?

[ 📦 Parcel ] [ 🛒 Groceries ]
[ 🧾 Bills  ] [ 🏪 Pickup ]
[ ✏️ Other ]

────────────────────

🟢 12 Runners Available Nearby

[ View Available Runners → ]

────────────────────

📋 Your Active Requests

J&T Parcel Pickup
Runner: DumbDizz 69
🟡 Waiting for runner

[View Request]
```

The dashboard should immediately answer:

> **"What can I request, and who can help me?"**

---

## 1.2 Quick Request ⭐⭐⭐

Allow users to start with the task instead of manually browsing every runner.

Flow:

```text
I need help
     ↓
Choose service
     ↓
Enter pickup/delivery information
     ↓
Find suitable available runners
     ↓
Choose runner
     ↓
Send request
```

Example:

```text
What do you need?

📦 Pick up a parcel

Where?
[ J&T Sahabat ]

Deliver to?
[ Sahabat 05 ]

When?
[ ASAP ▼ ]

[ Find Available Runners ]
```

Then show suitable runners:

```text
3 runners can help

🟢 Runner A
📍 1.2 km
⭐ 4.9
📦 Parcel Pickup

🟢 Runner B
📍 2.1 km
⭐ 4.7
📦 Parcel Pickup

🟢 Runner C
📍 3.4 km
⭐ 5.0
📦 Parcel Pickup
```

This should eventually become one of the main JomCOD flows.

---

## 1.3 Active Request Tracking ⭐⭐⭐

Make the existing "My Requests" experience more visual.

Example:

```text
YOUR REQUEST

📦 Parcel Pickup

1. Request sent       ✓
2. Runner accepted    ✓
3. Contact runner     ●
4. Task in progress   ○
5. Completed           ○
```

This gives the Community user a clear understanding of what is happening.

---

## 1.4 Favorites / Trusted Runners ⭐⭐

Allow Community users to save runners they trust.

Example:

```text
❤️ My Runners

DumbDizz 69
⭐ 4.9
🟢 Available

[Request]
```

This is especially useful when people repeatedly request the same local runners.

---

## 1.5 Re-request ⭐⭐⭐

After a completed job:

```text
Completed

J&T Parcel Pickup
DumbDizz 69

[ ⭐ Rate Runner ]
[ 🔄 Request Again ]
```

The next request can automatically pre-fill:

- Service
- Pickup location
- Delivery location
- Previous notes

The Community user only changes what is necessary.

---

## 1.6 Community History

Keep the existing History page but make it more useful.

Suggested structure:

```text
History

All | Completed | Cancelled | Expired

📦 J&T Pickup
DumbDizz 69
12 Aug 2026
✓ Completed

🛒 Grocery Run
Runner A
10 Aug 2026
✓ Completed
```

Tapping a job should open its full detail.

---

## 1.7 Report / Block Runner

Add basic trust and safety controls.

Runner profile menu:

```text
•••

Report Runner
Block Runner
```

These controls do not need to be prominent, but they should be available.

---

# 2. 🛵 Runner Side

The current Runner side already has a strong foundation:

- Status
- Schedule
- Services
- Open requests
- Accept / Decline
- Mark as done
- Realtime alerts
- History
- Runner statistics

The next improvements should make the Runner side feel like a **work dashboard**.

---

## 2.1 "Today" Dashboard ⭐⭐⭐

Make the Runner dashboard primarily about current work.

Example:

```text
Good afternoon, DumbDizz 👋

🟢 YOU ARE AVAILABLE

[ Go Offline ]

────────────────────

📋 TODAY

2 Active Requests
5 Completed

────────────────────

🔥 OPEN REQUESTS

📦 Parcel Pickup
Sahabat 05
~2 km

[ Claim ]

────────────────────

MY CURRENT JOB

🛒 Grocery Run
Community: Pachai
🟡 In Progress

[ WhatsApp ]
[ Mark as Done ]
```

The runner should immediately know:

> **"Am I available? Do I have a job? Are there jobs I can take?"**

---

## 2.2 Incoming Request Screen ⭐⭐⭐

When a direct request arrives, make it impossible to miss.

Example:

```text
🔔 NEW REQUEST

📦 Parcel Pickup

From:
J&T Sahabat

Deliver to:
Sahabat 05

Notes:
"Please call receiver before delivery."

Requested by:
Pachai

[ DECLINE ]     [ ACCEPT ]
```

This should integrate with the existing realtime notification system.

---

## 2.3 "My Active Job" ⭐⭐⭐

Once a runner accepts a request, show one obvious active-job card.

Example:

```text
CURRENT JOB

📦 Parcel Pickup

Community
Pachai

Pickup
J&T Sahabat

Deliver
Sahabat 05

Notes
Leave at house if nobody answers.

────────────────

[ 💬 WhatsApp ]

[ ✓ MARK AS DONE ]
```

The runner should not need to search through the dashboard or history to find their current job.

---

## 2.4 Availability Control ⭐⭐⭐

Availability should be one of the largest elements on the Runner dashboard.

Available:

```text
┌──────────────────────────┐
│ 🟢 AVAILABLE             │
│                          │
│ You can receive jobs     │
│                          │
│        [ GO OFFLINE ]    │
└──────────────────────────┘
```

Offline:

```text
┌──────────────────────────┐
│ ⚫ OFFLINE               │
│                          │
│ You won't receive jobs   │
│                          │
│        [ GO AVAILABLE ]  │
└──────────────────────────┘
```

This is central to JomCOD.

---

## 2.5 Service Management ⭐⭐

Improve the existing service configuration.

Example:

```text
MY SERVICES

✓ Parcel Pickup
✓ Grocery Shopping
✓ Bill Payment

+ Add Service
```

Each service can have its own information:

```text
Parcel Pickup
Price: RM8/trip

[ Edit ]
```

The price is informational only if JomCOD itself does not process payments.

---

## 2.6 Weekly Runner Schedule ⭐⭐

Expand the current availability schedule into a weekly view.

Example:

```text
MY AVAILABILITY

Monday       8:00 AM – 6:00 PM
Tuesday      8:00 AM – 6:00 PM
Wednesday    OFF
Thursday     8:00 AM – 6:00 PM
Friday       2:00 PM – 6:00 PM
Saturday     8:00 AM – 12:00 PM
Sunday       OFF
```

The system can then show users when the runner normally expects to be available.

---

## 2.7 Runner Performance ⭐⭐

If JomCOD does not process payments, focus on reputation and reliability rather than earnings.

Suggested metrics:

```text
MY PERFORMANCE

⭐ 4.9 Rating

✓ 38 Jobs Completed

📈 96% Completion Rate

⚡ Avg. Response
~3 min

🏆 Top Runner
```

This provides motivation without requiring JomCOD to handle money.

---

## 2.8 Runner Reputation Levels ⭐

Optional future feature.

Example:

```text
🏃 Runner
⭐⭐

Trusted Runner
⭐⭐⭐

Reliable Runner
⭐⭐⭐⭐

Community Hero
⭐⭐⭐⭐⭐
```

Possible criteria:

- Completed jobs
- Ratings
- Completion rate
- Account age
- Reports

Avoid making the reputation system easy to exploit.

---

# 3. 🔥 Major Feature — Available Nearby

This could eventually become one of the defining features of JomCOD.

Community opens:

```text
WHO'S AVAILABLE?

┌─────────────────────────────┐
│            MAP              │
│                             │
│       🟢 A                  │
│                 🟢 B        │
│                             │
│   🟢 C                      │
│                             │
└─────────────────────────────┘

3 runners available

A — 0.8 km
B — 1.4 km
C — 2.1 km
```

Possible flow:

```text
Choose service
      ↓
Filter available runners
      ↓
Sort by distance
      ↓
Select runner
      ↓
View profile
      ↓
Request
```

This directly answers the main JomCOD question:

> **"Who's available around me right now?"**

Precise home locations should not be publicly exposed. Use approximate location or controlled distance calculations.

---

# 4. Recommended Navigation

## 🏠 Community

### Home
- Quick Request
- Available Runners
- Active Requests
- Favorites

### Browse
- Search
- Service filters
- Area filters
- Availability
- Nearby

### Requests
- Active
- History

### News

### Settings

---

# 5. 🛵 Runner

## Home
- Availability
- Active Job
- Open Requests
- Today's activity

## Jobs
- Active
- History

## Services
- Services
- Pricing
- Schedule

## Profile

## News

## Settings

---

# 6. Product Philosophy

Do not make Community and Runner sides identical.

They have different primary questions.

### 🏠 Community

> **"Who can help me?"**

The Community side should prioritize:

- Discovery
- Availability
- Service matching
- Nearby runners
- Requesting
- Tracking
- Trust

### 🛵 Runner

> **"Can I help someone right now?"**

The Runner side should prioritize:

- Availability
- Incoming requests
- Active jobs
- Open broadcasts
- Job completion
- Schedule
- Reputation

---

# 7. Priority Order

Do not implement every feature at once.

## Phase 1 — Core Experience

1. Community Home / Find Help
2. Runner Today Dashboard
3. Active Request Tracking
4. Runner Active Job
5. Strong Availability Control

## Phase 2 — Better Discovery

6. Quick Request
7. Available Nearby
8. Service-based matching
9. Favorites / Trusted Runners
10. Re-request

## Phase 3 — Trust

11. Report Runner
12. Block Runner
13. Completion rate
14. Runner reputation
15. Better reviews

## Phase 4 — Advanced Local Discovery

16. Approximate geolocation
17. Distance calculation
18. Nearby runner sorting
19. Map view

---

# 8. Final Goal

The ideal JomCOD experience should feel extremely simple.

### Community

```text
I need help
     ↓
What do I need?
     ↓
Who is available?
     ↓
Choose runner
     ↓
Send request
     ↓
Runner accepts
     ↓
WhatsApp
     ↓
Task completed
     ↓
Rate
```

### Runner

```text
Go Available
     ↓
Receive request
     ↓
Accept
     ↓
WhatsApp
     ↓
Do the task
     ↓
Mark Done
     ↓
Build reputation
```

The central identity of JomCOD should remain:

> **"I need something done nearby. Who is available to help me?"**
