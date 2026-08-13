"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PhoneFrame from "@/components/PhoneFrame";
import Button from "@/components/Button";
import RoleBadge from "@/components/RoleBadge";
import ItemList from "@/components/ItemList";
import { JobRequest, Review, RunnerStatus, Service } from "@/lib/types";
import { cleanServiceName, formatRM, OTHER_SERVICE, SERVICE_PRESETS, titleCase, waLink } from "@/lib/constants";
import { parseDeliverTo } from "@/components/RequestFields";
import { createClient } from "@/lib/supabase/client";
import {
  acceptJob,
  addReview,
  cancelJob,
  claimBroadcast,
  declineJob,
  expireStaleJobs,
  fetchContact,
  fetchJobsForRequester,
  fetchJobsForRunner,
  fetchOpenBroadcasts,
  fetchReviewForJob,
  fetchReviewsForRunner,
  fetchRunners,
  getProfile,
  jobFromRow,
  markJobDone,
  refreshAvailability,
  setAvailability,
  touchAvailability,
  updateProfile,
  type ProfileRow,
} from "@/lib/queries";

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

const QUICK_SERVICES = [
  { emoji: "📦", label: "Parcel", value: "Parcel Pickup" },
  { emoji: "🛒", label: "Groceries", value: "Grocery Run" },
  { emoji: "🧾", label: "Bills", value: "Pay Bills (Toll / Water / Electric)" },
  { emoji: "🏪", label: "Pickup", value: "Drop-Off Parcel" },
  { emoji: "✏️", label: "Other", value: "" },
];

const serviceEmoji = (s: string): string => {
  const t = s.toLowerCase();
  if (t.includes("parcel")) return "📦";
  if (t.includes("grocery") || t.includes("shop") || t.includes("buy")) return "🛒";
  if (t.includes("food") || t.includes("takeaway")) return "🍔";
  if (t.includes("document") || t.includes("delivery")) return "📄";
  if (t.includes("bill") || t.includes("top") || t.includes("atm") || t.includes("bank")) return "🧾";
  if (t.includes("petrol")) return "⛽";
  if (t.includes("pharmacy")) return "💊";
  if (t.includes("laundry")) return "🧺";
  if (t.includes("queue") || t.includes("collect")) return "🎟️";
  return "⚡";
};

interface ParsedNotes {
  items: { name: string; qty: string; price: string }[];
  services: string[];
  neededBy: string | null;
  total: string | null;
  extra: string[];
}

function parseNotes(notes: string): ParsedNotes {
  const items: { name: string; qty: string; price: string }[] = [];
  const services: string[] = [];
  let neededBy: string | null = null;
  let total: string | null = null;
  const extra: string[] = [];
  for (const line of notes.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const svcMatch = t.match(/^Service:\s*(.*)$/i);
    if (svcMatch) {
      services.push(svcMatch[1].trim());
      continue;
    }
    const totalMatch = t.match(/^Total:\s*(.*)$/i);
    if (totalMatch) {
      total = totalMatch[1].trim();
      continue;
    }
    const itemsMatch = t.match(/^Items:\s*(.*)$/i);
    if (itemsMatch) {
      for (const part of itemsMatch[1].split(",")) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const pm = trimmed.match(/^(.*?)\s*[×x*]\s*([\d.]+)\s*(?:@\s*(RM[\d.]+))?/i);
        if (pm) {
          items.push({
            name: pm[1].trim(),
            qty: pm[2].trim(),
            price: pm[3]?.trim() ?? "",
          });
        } else {
          items.push({ name: trimmed, qty: "", price: "" });
        }
      }
      continue;
    }
    const needMatch = t.match(/^Needed By:\s*(.*)$/i);
    if (needMatch) {
      neededBy = needMatch[1].trim();
      continue;
    }
    extra.push(t);
  }
  return { items, services, neededBy, total, extra };
}

const requestAgainHref = (job: JobRequest): string => {
  if (!job.runnerId) return "/broadcast";
  const parsed = parseDeliverTo(job.deliverTo);
  const q = new URLSearchParams({
    runner: job.runnerId,
    service: job.serviceType,
    take: job.takeFrom,
    sahabat: parsed.sahabat,
    no: parsed.noRumah,
    unit: parsed.unit,
    block: parsed.block,
    area: parsed.deliveryArea,
    sign: parsed.receiverName,
    notes: job.notes ?? "",
  });
  return `/request?${q.toString()}`;
};

const STATUS_OPTIONS: { value: RunnerStatus; label: string; color: string }[] = [
  { value: "available", label: "Available", color: "#2E6E62" },
  { value: "busy", label: "Busy", color: "#F2B705" },
  { value: "delivery", label: "On delivery", color: "#E85D2C" },
  { value: "offline", label: "Offline", color: "#6B7280" },
];

const JOB_STYLES: Record<JobRequest["status"], string> = {
  pending: "bg-[#FDF6E3] text-[#8A6D00]",
  confirmed: "bg-[#F0F8F5] text-teal",
  done: "bg-[#E4F3EC] text-teal",
  expired: "bg-[#F5E4E0] text-orange",
  cancelled: "bg-[#EEEEEE] text-slate",
};

const JOB_LABELS: Record<JobRequest["status"], string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  done: "Completed",
  expired: "Expired",
  cancelled: "Cancelled",
};

const JOB_BANDS: Record<JobRequest["status"], string> = {
  pending: "bg-[#FDF6E3] border-[#F0E0A8]",
  confirmed: "bg-[#FDEFE3] border-[#F5D5C4]",
  done: "bg-[#E4F3EC] border-[#C8E6DA]",
  expired: "bg-paper2 border-line",
  cancelled: "bg-[#F3F3F3] border-line",
};

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const emptyService = (): Service => ({
  id: newId(),
  name: SERVICE_PRESETS[0],
  pricing: { model: "flat_rate", price: 8 },
});

interface Contact {
  name: string;
  whatsapp: string;
}

type Toast =
  | { kind: "accepted"; job: JobRequest; contact?: Contact }
  | { kind: "done"; job: JobRequest; contact?: Contact }
  | { kind: "expired"; job: JobRequest }
  | { kind: "cancelled"; job: JobRequest }
  | { kind: "new"; job: JobRequest }
  | { kind: "broadcast"; job: JobRequest }
  | { kind: "claimed"; job: JobRequest }
  | { kind: "too-late"; job: JobRequest }
  | { kind: "error"; message: string }
  | null;

function RatingCard({
  job,
  onSubmitted,
}: {
  job: JobRequest;
  onSubmitted: (review: Review) => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (rating < 1 || !job.runnerId) return;
    setSaving(true);
    setError("");
    const res = await addReview({ jobId: job.id, runnerId: job.runnerId, rating, text });
    setSaving(false);
    if (!res.ok) {
      setError(res.message ?? "Couldn't save your rating. Please try again.");
      return;
    }
    onSubmitted({ id: newId(), authorName: "You", rating, text });
  };

  return (
    <div className="bg-[#FDF6E3] border border-[#F0E0A8] rounded-[10px] px-3.5 py-3 mt-2.5">
      <div className="text-[12px] font-semibold mb-2">Rate this runner</div>
      <div className="flex gap-1 mb-2.5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            className={`text-lg leading-none ${n <= (hover || rating) ? "text-yellow" : "text-[#D8D2BE]"}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        className="w-full bg-white border border-line rounded-[10px] px-3 py-2 text-[12.5px] min-h-[54px] mb-2"
        placeholder="How was the service? (optional)"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error && <div className="text-[11.5px] text-orange mb-2">{error}</div>}
      <Button
        variant="secondary"
        className="w-auto px-3 py-1.5 text-[11.5px] rounded-lg"
        onClick={submit}
        disabled={saving || rating < 1}
      >
        {saving ? "Submitting…" : "Submit rating"}
      </Button>
    </div>
  );
}

function JobInfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper2 rounded-[8px] px-2.5 py-2 min-w-0">
      <div className="text-[9px] text-slate font-semibold uppercase tracking-wide">{label}</div>
      <div className="text-[11.5px] text-ink font-semibold mt-0.5 break-words">{value}</div>
    </div>
  );
}

function RequestSteps({ status }: { status: JobRequest["status"] }) {
  const steps = [
    "Request sent",
    "Runner accepted",
    "Contact runner",
    "Task in progress",
    "Completed",
  ];
  const doneUpTo =
    status === "pending"
      ? 1
      : status === "confirmed"
      ? 2
      : status === "done"
      ? steps.length
      : 0;

  return (
    <div className="mt-3 pt-2.5 border-t border-line space-y-1">
      {steps.map((s, i) => {
        const idx = i + 1;
        const isDone = idx <= doneUpTo;
        const isActive = status === "confirmed" && idx === 3;
        return (
          <div key={s} className="flex items-center gap-2">
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
                isDone ? "bg-teal text-white" : isActive ? "bg-orange text-white" : "bg-paper2 text-slate"
              }`}
            >
              {isDone ? "✓" : idx}
            </span>
            <span
              className={`text-[11px] leading-tight ${
                isDone
                  ? "text-ink font-semibold"
                  : isActive
                  ? "text-orange font-semibold"
                  : "text-slate"
              }`}
            >
              {s}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<RunnerStatus>("offline");
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [scheduleFrom, setScheduleFrom] = useState("");
  const [scheduleTo, setScheduleTo] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [jobs, setJobs] = useState<JobRequest[]>([]);
  const [myJobs, setMyJobs] = useState<JobRequest[]>([]);
  const [openJobs, setOpenJobs] = useState<JobRequest[]>([]);
  const [availableRunners, setAvailableRunners] = useState(0);
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [runnerRating, setRunnerRating] = useState<number | null>(null);
  const [runnerEarned, setRunnerEarned] = useState(0);
  const [reviews, setReviews] = useState<Record<string, Review | null>>({});
  const [toast, setToast] = useState<Toast>(null);
  const [loaded, setLoaded] = useState(false);
  const [servicesSaved, setServicesSaved] = useState(false);
  const [showRatingFor, setShowRatingFor] = useState<string | null>(null);
  const [approved, setApproved] = useState<boolean | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 10000);
    return () => clearTimeout(t);
  }, [toast]);

  const loadContacts = async (ids: Array<string | null | undefined>) => {
    const unique = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
    const entries = await Promise.all(
      unique.map(async (id) => {
        const c = await fetchContact(id);
        return [id, { name: c?.name ?? "Runner", whatsapp: c?.whatsapp ?? "" }] as const;
      })
    );
    setContacts((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
  };

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      // Housekeeping: expire stale broadcasts + auto-offline stale
      // "available" runners so the board and browse stay honest.
      refreshAvailability();
      expireStaleJobs();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const md = user?.user_metadata ?? {};
      setArea(md.area ?? "");
      const userRole = (md.role ?? "community") as string;
      setRole(userRole);

      const profile = await getProfile();
      setName(profile?.username ?? md.username ?? md.full_name ?? md.name ?? "");
      if (profile) {
        if (profile.status) setStatus(profile.status as RunnerStatus);
        setScheduleFrom(profile.schedule_from ?? "");
        setScheduleTo(profile.schedule_to ?? "");
        setApproved(profile.is_approved ?? true);
        const rawServices = Array.isArray(profile.services)
          ? (profile.services as Service[])
          : [];
        const cleanedServices = rawServices.map((s) => ({
          ...s,
          name: cleanServiceName(s.name),
        }));
        setServices(cleanedServices);
        if (
          cleanedServices.some((s, i) => s.name !== rawServices[i]?.name)
        ) {
          updateProfile({ services: cleanedServices as unknown as ProfileRow["services"] });
        }
      } else {
        // No profile row yet (account created before the trigger) — create one.
        await supabase.from("profiles").upsert({
          id: user!.id,
          full_name: md.full_name ?? md.name ?? "",
          username: md.username ?? null,
          role: md.role ?? "community",
          whatsapp: md.whatsapp ?? "",
          area: md.area ?? "",
          status: "offline",
          schedule_from: "",
          schedule_to: "",
          services: [],
        });
      }

      if (user) {
        if (userRole === "runner") {
          const list = await fetchJobsForRunner(user.id);
          setJobs(list);
          loadContacts(list.map((j) => j.requesterId));
          const opens = await fetchOpenBroadcasts();
          setOpenJobs(opens);
          touchAvailability();

          const pending = list.filter((j) => j.status === "pending");
          if (pending.length > 0) {
            setToast({ kind: "new", job: pending[0] });
          }

          const done = list.filter((j) => j.status === "done");

          const reviews = await fetchReviewsForRunner(user.id);
          if (reviews.length > 0) {
            setRunnerRating(
              Math.round((reviews.reduce((s, x) => s + x.rating, 0) / reviews.length) * 10) / 10
            );
          }

          const reviewEntries = await Promise.all(
            done.map(async (j) => [j.id, await fetchReviewForJob(j.id)] as const)
          );
          setReviews(Object.fromEntries(reviewEntries));

          const earned = done.reduce((sum, j) => {
            const svc = (profile?.services as Service[] | undefined)?.find(
              (s) => s.name.toLowerCase() === j.serviceType.toLowerCase()
            );
            if (svc && svc.pricing.model !== "custom" && typeof svc.pricing.price === "number") {
              return sum + svc.pricing.price;
            }
            return sum;
          }, 0);
          setRunnerEarned(earned);
        } else {
          const list = await fetchJobsForRequester(user.id);
          setMyJobs(list);
          loadContacts(list.map((j) => j.runnerId));
          fetchRunners().then((runners) =>
            setAvailableRunners(runners.filter((r) => r.status === "available").length)
          );
          // Load existing reviews for completed jobs.
          const done = list.filter((j) => j.status === "done");
          const reviewEntries = await Promise.all(
            done.map(async (j) => {
              const r = await fetchReviewForJob(j.id);
              return [j.id, r] as const;
            })
          );
          setReviews(Object.fromEntries(reviewEntries));
        }
      }
      setLoaded(true);
    })();
  }, []);

  const changeJobStatus = async (job: JobRequest, next: JobRequest["status"]) => {
    const res =
      next === "confirmed"
        ? await acceptJob(job.id)
        : next === "done"
        ? await markJobDone(job.id)
        : next === "cancelled"
        ? await declineJob(job.id)
        : null;
    if (!res) return;
    if (res.ok) {
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: next } : j)));
    } else {
      setToast({ kind: "error", message: res.message ?? "Couldn't update the job." });
    }
  };

  const claimJob = async (job: JobRequest) => {
    const won = await claimBroadcast(job.id);
    if (won.ok) {
      const claimed: JobRequest = { ...job, status: "confirmed" };
      setOpenJobs((prev) => prev.filter((j) => j.id !== job.id));
      setJobs((prev) => [claimed, ...prev]);
      setToast({ kind: "claimed", job: claimed });
    } else {
      // Someone else got it first, or the runner already has an active job.
      const opens = await fetchOpenBroadcasts();
      setOpenJobs(opens);
      setToast(
        won.message ? { kind: "error", message: won.message } : { kind: "too-late", job }
      );
    }
  };

  // Realtime subscriptions.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channels: ReturnType<typeof supabase.channel>[] = [];
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const teardown = () => {
      cancelled = true;
      channels.forEach((ch) => supabase.removeChannel(ch));
      channels = [];
      if (pollInterval) clearInterval(pollInterval);
    };

    const onError = (setup: () => void) => (status: string) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        // Supabase realtime can be flaky in dev — retry in a moment.
        setTimeout(() => {
          if (cancelled) return;
          channels.forEach((ch) => supabase.removeChannel(ch));
          channels = [];
          setup();
        }, 4000);
      }
    };

    const setupChannel = async () => {
      if (cancelled) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      const uid = user.id;
      const userRole = (user.user_metadata?.role ?? "community") as string;

      const name = `jobs-${uid}-${Date.now()}`;

      if (userRole === "runner") {
        const personal = supabase
          .channel(name)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "jobs",
              filter: `runner_id=eq.${uid}`,
            },
            (payload) => {
              const job = jobFromRow(payload.new as Parameters<typeof jobFromRow>[0]);
              setJobs((prev) => [job, ...prev]);
              loadContacts([job.requesterId]);
              setToast({ kind: "new", job });
            }
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "jobs",
              filter: `runner_id=eq.${uid}`,
            },
            (payload) => {
              const job = jobFromRow(payload.new as Parameters<typeof jobFromRow>[0]);
              setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)));
              loadContacts([job.requesterId]);
            }
          )
          .subscribe(onError(setupChannel));
        channels.push(personal);

        // Live broadcasts: new open job → alert + add to board.
        const broadcast = supabase
          .channel(`open-jobs-${uid}-${Date.now()}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "jobs",
              filter: `runner_id=is.null`,
            },
            (payload) => {
              const job = jobFromRow(payload.new as Parameters<typeof jobFromRow>[0]);
              if (job.status !== "pending") return;
              setOpenJobs((prev) => [job, ...prev]);
              setToast({ kind: "broadcast", job });
            }
          )
          .subscribe();
        channels.push(broadcast);

        // Poll fallback — keeps the open board honest when realtime misses
        // a claim/expiry (claimed broadcasts no longer match the filter).
        pollInterval = setInterval(async () => {
          if (cancelled) return;
          const opens = await fetchOpenBroadcasts();
          setOpenJobs(opens);
        }, 8000);
      } else {
        const my = supabase
          .channel(name)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "jobs",
              filter: `requester_id=eq.${uid}`,
            },
            (payload) => {
              const job = jobFromRow(payload.new as Parameters<typeof jobFromRow>[0]);
              setMyJobs((prev) => [job, ...prev]);
              loadContacts([job.runnerId]);
            }
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "jobs",
              filter: `requester_id=eq.${uid}`,
            },
            (payload) => {
              const job = jobFromRow(payload.new as Parameters<typeof jobFromRow>[0]);
              setMyJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)));
              loadContacts([job.runnerId]);
              if (job.status === "confirmed") {
                setToast({ kind: "accepted", job });
              } else if (job.status === "done") {
                setToast({ kind: "done", job });
              } else if (job.status === "expired") {
                setToast({ kind: "expired", job });
              } else if (job.status === "cancelled") {
                setToast({ kind: "cancelled", job });
              }
            }
          )
          .subscribe(onError(setupChannel));
        channels.push(my);
      }
    };

    setupChannel();

    return teardown;
  }, []);

  // Heartbeat: while the runner dashboard is open, keep last_seen_at fresh so
  // an "Available" runner isn't mistaken for stale and auto-offlined.
  useEffect(() => {
    if (role !== "runner") return;
    const id = setInterval(() => {
      touchAvailability();
    }, 30000);
    return () => clearInterval(id);
  }, [role]);

  const setRunnerStatus = async (value: RunnerStatus) => {
    setStatus(value);
    const res = await setAvailability(value);
    if (!res.ok) {
      setStatus(status);
      setToast({ kind: "error", message: res.message ?? "Couldn't update your status." });
    }
  };

  const updateService = (id: string, patch: Partial<Service>) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  };

  const updatePricing = (id: string, patch: Partial<Service["pricing"]>) => {
    setServices((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, pricing: { ...s.pricing, ...patch } } : s
      )
    );
  };

  const saveServices = async () => {
    setServicesSaved(false);
    const cleaned = services
      .filter((s) => s.name.trim() !== "")
      .map((s) => ({ ...s, name: titleCase(cleanServiceName(s.name)) }));
    await updateProfile({ services: cleaned as unknown as ProfileRow["services"] });
    setServices(cleaned);
    setServicesSaved(true);
  };

  if (!loaded) {
    return (
      <PhoneFrame>
        <div className="text-center py-10 text-[12.5px] text-slate">Loading…</div>
      </PhoneFrame>
    );
  }

  // ---------- Community view ----------
  if (role === "community") {
    return (
      <PhoneFrame>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <div className="text-[19px] md:text-[24px] font-bold font-display">Find help</div>
          <RoleBadge role="community" />
        </div>
        <div className="text-[12.5px] text-slate mb-4.5">
          {greeting()}, {name?.split(" ")[0] || "neighbour"} · {area || "your area"}
        </div>

        {toast && toast.kind === "error" && (
          <div className="bg-white border-[1.5px] border-orange/40 rounded-card p-4 mb-4 shadow-[0_16px_40px_-16px_rgba(232,93,44,0.3)] overflow-hidden relative">
            <div className="absolute left-0 top-0 bottom-0 w-[5px] bg-orange" />
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-[#FDF3EE] flex items-center justify-center text-[18px] flex-shrink-0">
                ⚠️
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-ink">{toast.message}</div>
              </div>
            </div>
            <div className="flex gap-2 mt-3.5">
              <Button
                variant="outline"
                className="w-auto px-4 py-2 text-[11.5px] rounded-[10px]"
                onClick={() => setToast(null)}
              >
                OK
              </Button>
            </div>
          </div>
        )}

        {toast && toast.kind !== "error" && (
          <div className="bg-white border-[1.5px] border-teal/40 rounded-card p-4 mb-4 shadow-[0_16px_40px_-16px_rgba(46,110,98,0.4)] overflow-hidden relative">
            <div className="absolute left-0 top-0 bottom-0 w-[5px] bg-teal" />
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-[12px] bg-[#E4F3EC] flex items-center justify-center text-[20px] flex-shrink-0">
                  {toast.kind === "accepted" && "✅"}
                  {toast.kind === "done" && "🎉"}
                  {toast.kind === "expired" && "⏳"}
                  {toast.kind === "cancelled" && "🚫"}
                  {toast.kind === "new" && "📨"}
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-ink">
                    {toast.kind === "accepted" &&
                      `${toast.contact?.name ?? "Your runner"} accepted!`}
                    {toast.kind === "done" && "Request completed!"}
                    {toast.kind === "expired" && "Your request expired"}
                    {toast.kind === "cancelled" && "Request cancelled"}
                    {toast.kind === "new" && "Request sent"}
                  </div>
                  <div className="text-[11.5px] text-slate mt-0.5">
                    {toast.kind !== "cancelled" && toast.job.serviceType && (
                      <>
                        <span className="text-teal font-semibold">
                          {titleCase(toast.job.serviceType)}
                        </span>
                        <span className="mx-1.5 text-line">·</span>
                        {toast.job.takeFrom} → {toast.job.deliverTo}
                      </>
                    )}
                    {toast.kind === "accepted" && toast.contact?.whatsapp
                      ? " — reach them on WhatsApp below."
                      : toast.kind === "done"
                      ? " — don&apos;t forget to rate your runner!"
                      : ""}
                  </div>
                </div>
              </div>
              <button onClick={() => setToast(null)} className="text-slate hover:text-ink text-[14px] flex-shrink-0">
                ✕
              </button>
            </div>
            {toast.kind === "done" && (
              <Button
                variant="secondary"
                className="w-auto px-4 py-2 text-[11.5px] rounded-[10px] mt-3"
                onClick={() => setToast(null)}
              >
                ★ Rate your runner
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="bg-white border border-line rounded-[10px] p-3 text-center">
            <div className="font-mono font-semibold text-[17px] md:text-[20px]">{myJobs.length}</div>
            <div className="text-[9.5px] text-slate uppercase tracking-wide mt-0.5">Total requests</div>
          </div>
          <div className="bg-white border border-line rounded-[10px] p-3 text-center">
            <div className="font-mono font-semibold text-[17px] md:text-[20px] text-teal">
              {myJobs.filter((j) => j.status === "done").length}
            </div>
            <div className="text-[9.5px] text-slate uppercase tracking-wide mt-0.5">Completed</div>
          </div>
          <div className="bg-white border border-line rounded-[10px] p-3 text-center">
            <div className="font-mono font-semibold text-[17px] md:text-[20px] text-orange">
              {myJobs.filter((j) => j.status === "pending" || j.status === "confirmed").length}
            </div>
            <div className="text-[9.5px] text-slate uppercase tracking-wide mt-0.5">In progress</div>
          </div>
        </div>

        {/* Quick request — pick a service first */}
        <div className="text-[11px] font-mono uppercase tracking-wide text-slate mb-2">
          What do you need help with?
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-5">
          {QUICK_SERVICES.map((svc) => (
            <Link
              key={svc.label}
              href={`/broadcast${svc.value ? `?service=${encodeURIComponent(svc.value)}` : ""}`}
              className="bg-white border border-line rounded-[12px] p-3 text-center hover:border-orange transition-colors"
            >
              <div className="text-xl mb-1">{svc.emoji}</div>
              <div className="text-[12px] font-semibold">{svc.label}</div>
            </Link>
          ))}
        </div>

        {/* Available runners nearby */}
        <div className="flex items-center justify-between gap-3 bg-[#E4F3EC] border border-[#C8E6DA] rounded-card px-3.5 py-3 mb-5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-teal inline-block flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-teal">
                {availableRunners} runner{availableRunners === 1 ? "" : "s"} available nearby
              </div>
              <div className="text-[11px] text-slate">
                Ready to help in {area || "your area"} right now.
              </div>
            </div>
          </div>
          <Link href="/browse" className="shrink-0">
            <span className="inline-block bg-teal text-white rounded-[10px] px-3.5 py-2 text-[12px] font-semibold">
              View runners
            </span>
          </Link>
        </div>

        {/* Your requests */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-mono uppercase tracking-wide text-slate">
            Your requests
          </div>
          <Link href="/history" className="text-[11px] font-semibold text-teal hover:underline">
            History →
          </Link>
        </div>
        {myJobs.length === 0 ? (
          <div className="text-center bg-white border border-dashed border-line rounded-card px-5 py-8 mb-3.5">
            <div className="text-2xl mb-2">📦</div>
            <div className="font-display font-bold text-[14.5px] mb-1">No requests yet</div>
            <div className="text-[12px] text-slate leading-relaxed mb-4">
              Pick a service above, or find a runner from Browse — your requests will be tracked here.
            </div>
            <Link href="/browse" className="block">
              <Button variant="outline">Find a runner</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-2.5 md:grid-cols-2">
          {myJobs.map((job) => {
            const contact = job.runnerId ? contacts[job.runnerId] : undefined;
            const review = reviews[job.id];
            const deliverParts = job.deliverTo.split(" · ");
            const deliverAddr =
              deliverParts.length > 2 ? deliverParts.slice(0, 2).join(" · ") : job.deliverTo;
            const receiverName = deliverParts.length > 2 ? deliverParts[2] : null;
            return (
              <div key={job.id} className="bg-white border border-line rounded-[10px] px-3.5 py-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <Link href={`/job/${job.id}`} className="text-[15px] font-bold font-display break-words hover:text-teal transition-colors">
                      {titleCase(job.serviceType)}
                    </Link>
                    <div className="mt-1.5 space-y-1 text-[12.5px]">
                      <div className="leading-snug">
                        <span className="text-slate">Take from:</span>{" "}
                        <span className="font-semibold text-ink break-words">{job.takeFrom}</span>
                      </div>
                      <div className="leading-snug">
                        <span className="text-slate">Received By:</span>{" "}
                        <span className="font-semibold text-ink break-words">
                          {receiverName ?? deliverAddr}
                        </span>
                      </div>
                      <div className="leading-snug">
                        <span className="text-slate">Delivered To (Location):</span>{" "}
                        <span className="font-semibold text-ink break-words">{deliverAddr}</span>
                      </div>
                      <div className="leading-snug">
                        <span className="text-slate">Runner:</span>{" "}
                        <span className="font-semibold text-ink break-words">
                          {contact?.name ?? (job.runnerId ? "…" : "Broadcast")}
                        </span>
                      </div>
                    </div>

                    {parseNotes(job.notes ?? "").items.length > 0 && (
                      <div className="rounded-[10px] bg-[#F0F7F4] border border-[#D7EBE1] px-3 py-2 mt-2.5">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-teal mb-1.5">
                          Items ordered
                        </div>
                        <div className="space-y-1">
                          {parseNotes(job.notes ?? "").items.map((it, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 text-[12px]">
                              <span className="text-ink font-medium break-words">{it.name}</span>
                              <span className="font-mono text-teal whitespace-nowrap">
                                {it.qty ? `×${it.qty}` : ""}
                                {it.price ? ` · ${it.price}` : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {parseNotes(job.notes ?? "").total && (
                      <div className="flex items-center justify-between rounded-[10px] bg-[#E4F3EC] border border-[#C8E6DA] px-3 py-2 mt-2">
                        <span className="text-[11.5px] font-semibold text-teal">You pay the runner</span>
                        <span className="font-mono font-bold text-[14px] text-teal">
                          {parseNotes(job.notes ?? "").total}
                        </span>
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${JOB_STYLES[job.status]}`}
                  >
                    {JOB_LABELS[job.status]}
                  </span>
                </div>

                <RequestSteps status={job.status} />

                {job.status === "confirmed" && contact?.whatsapp && (
                  <a
                    href={waLink(contact.whatsapp) ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2.5 w-full rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold text-center inline-flex items-center justify-center gap-2 bg-[#25D366] text-white hover:opacity-90"
                  >
                    💬 Chat with {contact.name.split(" ")[0]} on WhatsApp
                  </a>
                )}

                {(job.status === "pending" || job.status === "confirmed") && (
                  <Button
                    variant={confirmingCancel === job.id ? "primary" : "outline"}
                    className="mt-2.5 w-full px-3 py-2 text-[11.5px] rounded-lg"
                    onClick={async () => {
                      if (confirmingCancel !== job.id) {
                        setConfirmingCancel(job.id);
                        setTimeout(() => {
                          setConfirmingCancel((cur) => (cur === job.id ? null : cur));
                        }, 4000);
                        return;
                      }
                      setConfirmingCancel(null);
                      const res = await cancelJob(job.id);
                      if (res.ok) {
                        setMyJobs((prev) =>
                          prev.map((j) => (j.id === job.id ? { ...j, status: "cancelled" } : j))
                        );
                        setToast({ kind: "cancelled", job });
                      } else {
                        setToast({ kind: "error", message: res.message ?? "Couldn't cancel the request." });
                      }
                    }}
                  >
                    {confirmingCancel === job.id ? "Tap again to confirm cancel" : "Cancel request"}
                  </Button>
                )}

                {job.status === "done" &&
                  (review ? (
                    <div className="mt-2.5 text-[12px] text-teal font-semibold">
                      You rated {review.rating}★ {review.text ? `— "${review.text}"` : ""}
                    </div>
                  ) : (
                    <RatingCard
                      job={job}
                      onSubmitted={(review) => {
                        setReviews((prev) => ({ ...prev, [job.id]: review }));
                        setToast(null);
                      }}
                    />
                  ))}

                {job.status === "done" && (
                  <Link
                    href={requestAgainHref(job)}
                    className="mt-2.5 w-full rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold text-center inline-flex items-center justify-center gap-2 bg-orange/10 text-orange border border-orange/30 hover:bg-orange hover:text-white transition-colors"
                  >
                    🔄 Request again
                  </Link>
                )}
              </div>
            );
          })}
          </div>
        )}

        <div className="text-[11.5px] text-slate bg-paper2 rounded-lg px-3 py-2.5 mt-3.5 italic">
          Want to earn instead? Switch your role to Runner anytime — you can be both.
        </div>
      </PhoneFrame>
    );
  }

  // ---------- Runner view ----------
  const doneCount = jobs.filter((j) => j.status === "done").length;
  const closedCount = jobs.filter((j) => j.status === "done" || j.status === "expired").length;
  const completionRate = closedCount > 0 ? Math.round((doneCount / closedCount) * 100) : null;
  const liveOpenCount = openJobs.filter(
    (j) => Date.now() - j.createdAt < 5 * 60 * 1000
  ).length;
  return (
    <PhoneFrame>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <div className="text-[19px] md:text-[24px] font-bold font-display">Your day</div>
        <RoleBadge role="runner" />
      </div>
      <div className="text-[12.5px] text-slate mb-4.5">
        {greeting()}, {name?.split(" ")[0] || "runner"} · {area || "your area"}
      </div>

      {approved === false && (
        <div className="bg-[#FDF6E3] border border-[#F0E0A8] rounded-card px-3.5 py-3 mb-4">
          <div className="text-[13px] font-bold text-[#8A6D00]">🕐 Awaiting approval</div>
          <div className="text-[11.5px] text-slate mt-0.5 leading-snug">
            Your runner profile isn&apos;t visible in Browse yet. An admin needs to approve it —
            keep it to {name?.split(" ")[0] || "you"} while you wait.
          </div>
        </div>
      )}

      {/* Big availability control */}
      <div
        className={`rounded-card p-4 mb-4 ${
          status === "available"
            ? "bg-[#E4F3EC] border border-[#C8E6DA]"
            : "bg-ink text-paper"
        }`}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-3 h-3 rounded-full inline-block flex-shrink-0 ${
                status === "available" ? "bg-teal" : "bg-[#B9B2A0]"
              }`}
            />
            <div className="min-w-0">
              <div
                className={`text-[15px] font-bold font-display ${
                  status === "available" ? "text-teal" : "text-paper"
                }`}
              >
                {status === "available" ? "You are available" : "You are offline"}
              </div>
              <div
                className={`text-[11.5px] ${
                  status === "available" ? "text-slate" : "text-[#B8BDB9]"
                }`}
              >
                {status === "available"
                  ? "You can receive jobs now."
                  : "You won't receive jobs right now."}
              </div>
            </div>
          </div>
          <Button
            variant={status === "available" ? "secondary" : "primary"}
            className="w-auto px-4 py-2 text-[12px]"
            onClick={() => setRunnerStatus(status === "available" ? "offline" : "available")}
          >
            {status === "available" ? "Go offline" : "Go available"}
          </Button>
        </div>
      </div>

      {toast && (toast.kind === "new" || toast.kind === "broadcast") && (
        <div className="bg-white border-[1.5px] border-orange/40 rounded-card p-4 mb-4 shadow-[0_16px_40px_-16px_rgba(232,93,44,0.45)] overflow-hidden relative">
          <div className="absolute left-0 top-0 bottom-0 w-[5px] bg-orange" />
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-[12px] bg-[#FDF3EE] flex items-center justify-center text-[20px] flex-shrink-0">
                {toast.kind === "broadcast" ? "📣" : "🔔"}
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-bold text-ink">
                  {toast.kind === "broadcast" ? "New broadcast request!" : "New request!"}
                </div>
                <div className="text-[11.5px] text-slate mt-0.5">
                  <span className="text-orange font-semibold">{titleCase(toast.job.serviceType)}</span>
                  <span className="mx-1.5 text-line">·</span>
                  {toast.job.takeFrom} → {toast.job.deliverTo}
                  {toast.kind === "broadcast" && (
                    <span className="block mt-1 text-[10.5px] text-slate">
                      Open to all runners — first to accept wins.
                    </span>
                  )}
                  {parseNotes(toast.job.notes ?? "").items.length > 0 && (
                    <span className="block mt-1.5 space-y-0.5">
                      {parseNotes(toast.job.notes ?? "").items.map((it, i) => (
                        <span key={i} className="flex items-center gap-1.5 text-[11px] text-ink">
                          <span className="w-4 h-4 rounded-full bg-teal text-white text-[8.5px] font-bold flex items-center justify-center flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="break-words min-w-0 flex-1">{it.name}</span>
                          {it.qty && (
                            <span className="font-mono font-bold text-teal whitespace-nowrap">×{it.qty}</span>
                          )}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={() => setToast(null)} className="text-slate hover:text-ink text-[14px] flex-shrink-0">
              ✕
            </button>
          </div>
          <div className="flex gap-2 mt-3.5">
            <Button
              variant="primary"
              className="w-auto px-4 py-2 text-[11.5px] rounded-[10px] flex-1"
              onClick={() => {
                claimJob(toast.job);
                setToast(null);
              }}
            >
              {toast.kind === "broadcast" ? "⚡ Claim this job" : "✓ Accept"}
            </Button>
            <Button
              variant="outline"
              className="w-auto px-3 py-2 text-[11.5px] rounded-[10px]"
              onClick={() => setToast(null)}
            >
              {toast.kind === "broadcast" ? "Pass" : "Decline"}
            </Button>
          </div>
        </div>
      )}

      {toast && toast.kind === "error" && (
        <div className="bg-white border-[1.5px] border-orange/40 rounded-card p-4 mb-4 shadow-[0_16px_40px_-16px_rgba(232,93,44,0.3)] overflow-hidden relative">
          <div className="absolute left-0 top-0 bottom-0 w-[5px] bg-orange" />
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-[#FDF3EE] flex items-center justify-center text-[18px] flex-shrink-0">
              ⚠️
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-ink">{toast.message}</div>
            </div>
          </div>
          <div className="flex gap-2 mt-3.5">
            <Button
              variant="outline"
              className="w-auto px-4 py-2 text-[11.5px] rounded-[10px]"
              onClick={() => setToast(null)}
            >
              OK
            </Button>
          </div>
        </div>
      )}

      {toast && toast.kind === "claimed" && (
        <div className="bg-white border-[1.5px] border-teal/50 rounded-card p-4 mb-4 shadow-[0_16px_40px_-16px_rgba(46,110,98,0.45)] overflow-hidden relative">
          <div className="absolute left-0 top-0 bottom-0 w-[5px] bg-teal" />
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-[#E4F3EC] flex items-center justify-center text-[20px] flex-shrink-0">
              🎉
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-bold text-ink">You got the job!</div>
              <div className="text-[11.5px] text-slate mt-0.5">
                <span className="text-teal font-semibold">{titleCase(toast.job.serviceType)}</span>
                <span className="mx-1.5 text-line">·</span>
                {toast.job.takeFrom} → {toast.job.deliverTo}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3.5">
            <Button
              variant="primary"
              className="w-auto px-4 py-2 text-[11.5px] rounded-[10px] flex-1"
              onClick={() => setToast(null)}
            >
              Nice
            </Button>
          </div>
        </div>
      )}

      {toast && toast.kind === "too-late" && (
        <div className="bg-white border-[1.5px] border-line rounded-card p-4 mb-4 shadow-[0_16px_40px_-16px_rgba(28,35,33,0.2)] overflow-hidden relative">
          <div className="absolute left-0 top-0 bottom-0 w-[5px] bg-[#9AA09C]" />
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-[#F1EFE8] flex items-center justify-center text-[20px] flex-shrink-0">
              ⏱️
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-bold text-ink">Just missed it</div>
              <div className="text-[11.5px] text-slate mt-0.5">
                Another runner claimed that job first. Keep an eye out for the next one.
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3.5">
            <Button
              variant="outline"
              className="w-auto px-4 py-2 text-[11.5px] rounded-[10px]"
              onClick={() => setToast(null)}
            >
              OK
            </Button>
          </div>
        </div>
      )}

      {/* Current active job — the most important thing for a runner */}
      {(() => {
        const active = jobs.find((j) => j.status === "confirmed");
        if (!active) return null;
        const contact = active.requesterId ? contacts[active.requesterId] : undefined;
        const noteData = parseNotes(active.notes ?? "");
        return (
          <div className="bg-white border-[1.5px] border-orange rounded-card p-4 mb-4 shadow-[0_10px_30px_-12px_rgba(232,93,44,0.4)]">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="text-[11px] font-mono uppercase tracking-wide text-orange">
                Current job
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full whitespace-nowrap bg-[#F0F8F5] text-teal">
                Confirmed
              </span>
            </div>
            <div className="text-[15px] font-bold font-display">{titleCase(active.serviceType)}</div>
            <div className="text-[12px] text-slate mt-1 leading-snug">
              {active.takeFrom} → {active.deliverTo}
            </div>
            {noteData.services.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {noteData.services.map((s, i) => (
                  <span
                    key={i}
                    className="text-[10.5px] font-mono px-2 py-0.5 rounded-full bg-[#FDF3EE] text-orange border border-[#F5D5C4] whitespace-nowrap"
                  >
                    + {titleCase(s)}
                  </span>
                ))}
              </div>
            )}
            <ItemList items={noteData.items} title="What to buy / pick up" />
            {noteData.total && (
              <div className="flex items-center justify-between rounded-[10px] bg-[#E4F3EC] border border-[#C8E6DA] px-3 py-2 mt-2.5">
                <span className="text-[11.5px] font-semibold text-teal">Community pays</span>
                <span className="font-mono font-bold text-[14px] text-teal">{noteData.total}</span>
              </div>
            )}
            {noteData.extra.length > 0 && (
              <div className="text-[11.5px] text-[#4B5250] mt-2 space-y-0.5">
                {noteData.extra.map((line, i) => (
                  <div key={i} className="leading-snug break-words">{line}</div>
                ))}
              </div>
            )}
            {contact?.name && (
              <div className="text-[11px] font-mono text-slate mt-2">
                Requested by {contact.name}
              </div>
            )}
            <div className="flex gap-2 mt-3">
              {contact?.whatsapp && (
                <a
                  href={waLink(contact.whatsapp) ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold text-center inline-flex items-center justify-center gap-1.5 bg-[#25D366] text-white hover:opacity-90"
                >
                  💬 WhatsApp
                </a>
              )}
              <Button
                variant="secondary"
                className="flex-1 px-3 py-2.5 text-[12.5px]"
                onClick={() => changeJobStatus(active, "done")}
              >
                ✓ Mark as done
              </Button>
            </div>
          </div>
        );
      })()}

      <div className="text-[11px] font-mono uppercase tracking-wide text-slate mb-2">
        Open requests from the community
      </div>
      {(() => {
        const live = openJobs.filter((j) => Date.now() - j.createdAt < 5 * 60 * 1000);
        return live.length === 0 ? (
        <div className="bg-white border border-dashed border-line rounded-card px-4 py-5 mb-4 text-center">
          <div className="text-xl mb-1.5">📣</div>
          <div className="font-display font-bold text-[13.5px] mb-0.5">No open broadcasts</div>
          <div className="text-[11.5px] text-slate">
            When someone broadcasts to all runners, it appears here for you to claim.
          </div>
        </div>
        ) : (
        <div className="grid gap-2.5 mb-4 md:grid-cols-2 lg:grid-cols-3">
          {live.map((job) => {
            const bItems = parseNotes(job.notes ?? "").items;
            return (
            <div key={job.id} className="bg-[#FDF6E3] border border-[#F0E0A8] rounded-[10px] px-3.5 py-3">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold">{titleCase(job.serviceType)}</div>
                  <div className="text-[11.5px] text-slate mt-0.5 leading-snug">
                    {job.takeFrom} → {job.deliverTo}
                  </div>
                  <ItemList items={bItems} title="Items requested" />
                  <div className="text-[10px] font-mono text-slate mt-1.5">
                    Broadcast · open to all · expires in{" "}
                    {Math.max(0, 5 - Math.floor((Date.now() - job.createdAt) / 60000))}m
                  </div>
                </div>
              </div>
              <Button
                variant="secondary"
                className="w-auto px-3 py-1.5 text-[11.5px] rounded-lg mt-2"
                onClick={() => claimJob(job)}
              >
                ⚡ Claim this job
              </Button>
            </div>
            );
          })}
        </div>
        );
      })()}

      <div className="md:grid md:grid-cols-2 md:gap-6 md:items-start">
      <div className="min-w-0">
      <div className="text-[11px] font-mono uppercase tracking-wide text-slate mb-2">
        Your status
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setRunnerStatus(opt.value)}
            className={`border-[1.5px] rounded-[10px] px-2.5 py-2.5 text-left text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              status === opt.value ? "border-teal bg-[#F0F8F5]" : "border-line bg-white"
            }`}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: opt.color }} />
            {opt.label}
          </button>
        ))}
      </div>

      <div className="text-[11px] font-mono uppercase tracking-wide text-slate mb-2">
        My performance
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-[#FDF6E3] border border-[#F0E0A8] rounded-[10px] p-3 text-center">
          <div className="font-mono font-bold text-[18px] text-[#8A6D00]">
            ⭐ {runnerRating ?? "New"}
          </div>
          <div className="text-[9px] text-slate uppercase tracking-wide mt-0.5">Rating</div>
        </div>
        <div className="bg-[#E4F3EC] border border-[#C8E6DA] rounded-[10px] p-3 text-center">
          <div className="font-mono font-bold text-[18px] text-teal">✓ {doneCount}</div>
          <div className="text-[9px] text-slate uppercase tracking-wide mt-0.5">Jobs done</div>
        </div>
        <div className="bg-paper2 rounded-[10px] p-3 text-center">
          <div className="font-mono font-bold text-[18px]">
            {completionRate !== null ? `${completionRate}%` : "—"}
          </div>
          <div className="text-[9px] text-slate uppercase tracking-wide mt-0.5">Completion</div>
        </div>
        <div className="bg-white border border-line rounded-[10px] p-3 text-center">
          <div className="font-mono font-bold text-[18px] text-orange">{liveOpenCount}</div>
          <div className="text-[9px] text-slate uppercase tracking-wide mt-0.5">Open now</div>
        </div>
      </div>

      <div className="flex items-center justify-between bg-white border border-line rounded-[10px] px-3 py-2.5 mb-4">
        <span className="text-[11.5px] text-slate">💰 Est. earned</span>
        <span className="font-mono font-bold text-[14px]">{formatRM(runnerEarned)}</span>
      </div>
      </div>

      <div className="min-w-0">
      <div className="text-[11px] font-mono uppercase tracking-wide text-slate mb-2">
        Recent jobs
      </div>
      {jobs.length === 0 ? (
        <div className="text-center bg-white border border-dashed border-line rounded-card px-5 py-8 mb-3.5">
          <div className="text-2xl mb-2">📭</div>
          <div className="font-display font-bold text-[14.5px] mb-1">No jobs yet</div>
          <div className="text-[12px] text-slate leading-relaxed">
            Jobs you accept from the community will appear here.
          </div>
        </div>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2">
        {jobs.map((job) => {
          const contact = job.requesterId ? contacts[job.requesterId] : undefined;
          const review = reviews[job.id];
          const deliverParts = job.deliverTo.split(" · ");
          const deliverAddr =
            deliverParts.length > 2 ? deliverParts.slice(0, 2).join(" · ") : job.deliverTo;
          const receiverName = deliverParts.length > 2 ? deliverParts[2] : null;
          const {
            items,
            services: extraServices,
            neededBy,
            total,
            extra,
          } = parseNotes(job.notes ?? "");
          return (
            <div
              key={job.id}
              className="bg-white border border-line rounded-card overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
            >
              {/* Header band */}
              <div
                className={`px-3.5 py-2.5 flex items-center justify-between gap-2 border-b ${JOB_BANDS[job.status]}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[18px] leading-none flex-shrink-0">
                    {serviceEmoji(job.serviceType)}
                  </span>
                  <Link href={`/job/${job.id}`} className="text-[14px] font-bold font-display text-ink break-words hover:text-teal transition-colors">
                    {titleCase(job.serviceType)}
                  </Link>
                </div>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${JOB_STYLES[job.status]}`}
                >
                  {JOB_LABELS[job.status]}
                </span>
              </div>

              <div className="px-3.5 py-3">
                {/* Route line */}
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal flex-shrink-0" />
                  <span className="text-[12px] font-semibold text-ink truncate flex-1">
                    {job.takeFrom}
                  </span>
                  <span className="text-teal font-bold flex-shrink-0">→</span>
                  <span className="text-[12px] font-semibold text-ink truncate flex-1 text-right">
                    {deliverAddr}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-orange flex-shrink-0" />
                </div>

                {/* Detail tiles */}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <JobInfoTile label="Pickup location" value={job.takeFrom} />
                  <JobInfoTile label="Delivery location" value={deliverAddr} />
                  <JobInfoTile label="Received by" value={receiverName ?? "—"} />
                  <JobInfoTile label="Needed by" value={neededBy ?? "—"} />
                </div>

                {/* Extra services */}
                {extraServices.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {extraServices.map((s, i) => (
                      <span
                        key={i}
                        className="text-[10.5px] font-mono px-2 py-0.5 rounded-full bg-[#FDF3EE] text-orange border border-[#F5D5C4] whitespace-nowrap"
                      >
                        + {s}
                      </span>
                    ))}
                  </div>
                )}
                <ItemList items={items} title="What to buy / pick up" />
                {total && (
                  <div className="flex items-center justify-between rounded-[10px] bg-[#E4F3EC] border border-[#C8E6DA] px-3 py-2 mt-2.5">
                    <span className="text-[11.5px] font-semibold text-teal">Community pays</span>
                    <span className="font-mono font-bold text-[14px] text-teal">{total}</span>
                  </div>
                )}
                {extra.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {extra.map((line, i) => (
                      <div key={i} className="text-[11px] text-[#4B5250] leading-snug break-words">
                        {line}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                {job.status === "pending" && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="secondary"
                      className="flex-1 px-3 py-2 text-[11.5px] rounded-lg"
                      onClick={() => changeJobStatus(job, "confirmed")}
                    >
                      Accept job
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 px-3 py-2 text-[11.5px] rounded-lg"
                      onClick={() => changeJobStatus(job, "cancelled")}
                    >
                      Decline
                    </Button>
                  </div>
                )}
                {job.status === "confirmed" && (
                  <Button
                    variant="secondary"
                    className="w-full px-3 py-2 text-[11.5px] rounded-lg mt-3"
                    onClick={() => changeJobStatus(job, "done")}
                  >
                    Mark as done
                  </Button>
                )}
              </div>

              {/* Rating CTA — floating pill like before */}
              {job.status === "done" && (
                <div className="px-3.5 pb-3">
                  {review ? (
                    showRatingFor === job.id ? (
                      <div className="bg-[#FDF6E3] border border-[#F0E0A8] rounded-[10px] px-3.5 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[15px] leading-none">
                            <span className="text-yellow">{"★".repeat(review.rating)}</span>
                            <span className="text-[#D8D2BE]">{"★".repeat(5 - review.rating)}</span>
                          </div>
                          <button
                            onClick={() => setShowRatingFor(null)}
                            className="text-[11px] text-slate hover:text-ink"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="text-[10.5px] font-mono text-slate mt-1">
                          {review.rating}/5 from {review.authorName}
                        </div>
                        {review.text ? (
                          <div className="text-[12px] text-[#4B5250] italic mt-1">
                            &quot;{review.text}&quot;
                          </div>
                        ) : (
                          <div className="text-[12px] text-[#4B5250] mt-1">
                            No message left.
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowRatingFor(job.id)}
                        className="w-full rounded-[10px] px-4 py-2 text-[12px] font-semibold text-center inline-flex items-center justify-center gap-1.5 bg-[#FDF6E3] text-[#8A6D00] border border-[#F0E0A8] hover:bg-yellow/20 transition-colors"
                      >
                        ★ View rating from{" "}
                        {contact?.name?.split(" ")[0] ?? review.authorName ?? "community"}
                      </button>
                    )
                  ) : (
                    <div className="text-center text-[12px] text-slate italic">
                      No rating yet from the community
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        </div>
      )}

      <div className="text-[11px] font-mono uppercase tracking-wide text-slate mt-4 mb-2">
        Your services & pricing
      </div>
      <div className="grid gap-2.5">
      {services.map((svc) => {
        const isOther = !SERVICE_PRESETS.some(
          (p) => p.toLowerCase() === svc.name.toLowerCase()
        );
        return (
          <div key={svc.id} className="bg-white border border-line rounded-[10px] p-3">
            <div className="mb-2">
              <label className="text-[10px] font-semibold text-slate block mb-1">
                Service name
              </label>
              <select
                className="w-full bg-white border border-line rounded-[10px] px-3 py-2 text-[12.5px]"
                value={
                  isOther
                    ? OTHER_SERVICE
                    : (SERVICE_PRESETS.find(
                        (p) => p.toLowerCase() === svc.name.toLowerCase()
                      ) ?? svc.name)
                }
                onChange={(e) =>
                  updateService(svc.id, {
                    name: e.target.value === OTHER_SERVICE ? "" : e.target.value,
                  })
                }
              >
                {SERVICE_PRESETS.map((name) => (
                  <option key={name}>{name}</option>
                ))}
                <option>{OTHER_SERVICE}</option>
              </select>
              {isOther && (
                <>
                  <input
                    className="w-full bg-white border border-line rounded-[10px] px-3 py-2 text-[12.5px] mt-1.5"
                    placeholder="Write your own service name"
                    value={svc.name}
                    onChange={(e) => updateService(svc.id, { name: e.target.value })}
                  />
                  <div className="text-[10.5px] text-slate mt-1">
                    No courier names (JNT / SPX / GDEX) — those are just for parcel pickup details.
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2 items-start">
              <select
                className="bg-white border border-line rounded-[10px] px-2 py-2 text-[12px]"
                value={svc.pricing.model}
                onChange={(e) =>
                  updatePricing(svc.id, {
                    model: e.target.value as Service["pricing"]["model"],
                  })
                }
              >
                <option value="flat_rate">Flat rate</option>
                <option value="per_item">Per item</option>
                <option value="custom">Custom</option>
              </select>
              {svc.pricing.model === "custom" ? (
                <input
                  className="flex-1 bg-white border border-line rounded-[10px] px-3 py-2 text-[12.5px]"
                  placeholder="e.g. RM6 trip fee + RM1/stop"
                  value={svc.pricing.description ?? ""}
                  onChange={(e) =>
                    updatePricing(svc.id, { description: e.target.value })
                  }
                />
              ) : (
                <div className="flex-1 flex items-center gap-1.5 bg-white border border-line rounded-[10px] px-2.5">
                  <span className="text-[12px] text-slate font-mono">RM</span>
                  <input
                    type="number"
                    min={0}
                    className="flex-1 bg-transparent py-2 text-[12.5px] min-w-0"
                    placeholder="0.00"
                    value={svc.pricing.price ?? ""}
                    onChange={(e) =>
                      updatePricing(svc.id, { price: Number(e.target.value) })
                    }
                  />
                </div>
              )}
              <button
                onClick={() =>
                  setServices((prev) => prev.filter((s) => s.id !== svc.id))
                }
                className="text-[11px] text-orange font-semibold px-2 py-2"
              >
                Remove
              </button>
            </div>
          </div>
        );
      })}
      </div>

      <div className="flex items-center gap-2 mb-3.5 flex-wrap mt-4">
        <Button
          variant="outline"
          className="w-auto px-3 py-2 text-[12px]"
          onClick={() => setServices((prev) => [...prev, emptyService()])}
        >
          + Add service
        </Button>
        <Button variant="secondary" className="w-auto px-3 py-2 text-[12px]" onClick={saveServices}>
          Save services
        </Button>
        {servicesSaved && <span className="text-[11px] text-teal font-semibold">Saved ✓</span>}
      </div>
      <div className="text-[11.5px] text-slate bg-paper2 rounded-lg px-3 py-2.5 italic">
        These show on your public profile so neighbours know what you offer and how much.
      </div>
      </div>
      </div>
    </PhoneFrame>
  );
}
