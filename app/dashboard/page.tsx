"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import PhoneFrame from "@/components/PhoneFrame";
import Button from "@/components/Button";
import RoleBadge from "@/components/RoleBadge";
import ItemList from "@/components/ItemList";
import RouteInfo from "@/components/RouteInfo";
import { JobRequest, Review, RunnerStatus, Service } from "@/lib/types";
import { cleanServiceName, formatRM, normalizePrice, OTHER_SERVICE, SERVICE_PRESETS, serviceEmoji, serviceNameKey, titleCase, translateServiceName, waLink } from "@/lib/constants";
import ServicePicker from "@/components/ServicePicker";
import { formatDelivery, formatTakeFromLines, parseDeliverTo } from "@/lib/jobFormat";
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
  setJobTotal,
  touchAvailability,
  updateProfile,
  type ProfileRow,
} from "@/lib/queries";
import { estimateJobTotal } from "@/lib/estimate";
import { useI18n } from "@/lib/i18n";

const greeting = (t: (k: string) => string) => {
  const h = new Date().getHours();
  if (h < 12) return t("dash.greetingMorning");
  if (h < 18) return t("dash.greetingAfternoon");
  return t("dash.greetingEvening");
};

function parseTime12(t: string): { h: number; m: number } | null {
  const m = t?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return { h, m: parseInt(m[2], 10) };
}

// True when `now` falls inside the runner's schedule window. Handles both
// normal (8 AM–5 PM) and overnight (10 PM–6 AM) schedules.
function isWithinSchedule(from: string, to: string, now = new Date()): boolean {
  const s = parseTime12(from);
  const e = parseTime12(to);
  if (!s || !e) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = s.h * 60 + s.m;
  const end = e.h * 60 + e.m;
  if (start <= end) return cur >= start && cur < end;
  return cur >= start || cur < end;
}

// "RM24" / "RM24.50" → number. Used to total up what a runner actually earned
// from completed jobs (the exact amount is already saved in the job notes).
function totalToNumber(total: string | null): number {
  if (!total) return 0;
  const n = parseFloat(total.replace(/[^\d.]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

// Est. earned = sum of the exact "Total: RM…" saved in each done job's notes.
// Jobs created before the calculator keep the old notes format, so fall back
// to the runner's current service price for those. Derived reactively from
// the jobs + services state so it updates the moment a job is marked done
// (not just on page load).
function computeEarned(jobs: JobRequest[], services: Service[]): number {
  return jobs
    .filter((j) => j.status === "done")
    .reduce((sum, j) => {
      const fromNotes = totalToNumber(parseNotes(j.notes ?? "").total);
      if (fromNotes > 0) return sum + fromNotes;
      const primaryService = j.serviceType.split(" + ")[0].toLowerCase();
      const svc = services.find(
        (s) => cleanServiceName(s.name).toLowerCase() === primaryService
      );
      if (svc && svc.pricing.model !== "custom" && typeof svc.pricing.price === "number") {
        return sum + svc.pricing.price;
      }
      return sum;
    }, 0);
}

const QUICK_SERVICES = [
  { emoji: "📦", label: "Parcel", value: "Parcel Pickup / Drop-off", tKey: "dash.com.quickParcel" },
  { emoji: "🛒", label: "Groceries", value: "Grocery Run", tKey: "dash.com.quickGroceries" },
  { emoji: "🧾", label: "Bills", value: "Pay Bills", tKey: "dash.com.quickBills" },
  { emoji: "🏪", label: "Pickup", value: "Parcel Pickup / Drop-off", tKey: "dash.com.quickPickup" },
  { emoji: "✏️", label: "Other", value: "", tKey: "dash.com.quickOther" },
];

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
      total = normalizePrice(totalMatch[1].trim());
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
            price: normalizePrice(pm[3]?.trim() ?? ""),
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
  const { t } = useI18n();

  const submit = async () => {
    if (rating < 1 || !job.runnerId) return;
    setSaving(true);
    setError("");
    const res = await addReview({ jobId: job.id, runnerId: job.runnerId, rating, text });
    setSaving(false);
    if (!res.ok) {
      setError(res.message ?? t("dash.rating.saveError"));
      return;
    }
    onSubmitted({ id: newId(), authorName: t("dash.rating.you"), rating, text });
  };

  return (
    <div className="bg-[#FDF6E3] border border-[#F0E0A8] rounded-[10px] px-3.5 py-3 mt-2.5">
      <div className="text-[12px] font-semibold mb-2">{t("dash.rating.rateThisRunner")}</div>
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
        placeholder={t("dash.rating.howService")}
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
        {saving ? t("dash.rating.submitting") : t("dash.rating.submit")}
      </Button>
    </div>
  );
}

function JobInfoTile({
  label,
  value,
}: {
  label: string;
  value: string | ReactNode;
}) {
  return (
    <div className="bg-paper2 rounded-[8px] px-2.5 py-2 min-w-0">
      <div className="text-[9px] text-slate font-semibold uppercase tracking-wide">{label}</div>
      <div className="text-[11.5px] text-ink mt-0.5 break-words">{value}</div>
    </div>
  );
}

function RequestSteps({ status }: { status: JobRequest["status"] }) {
  const { t } = useI18n();
  const steps = [
    t("dash.steps.sent"),
    t("dash.steps.accepted"),
    t("dash.steps.inProgress"),
    t("dash.steps.completed"),
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
  const { t } = useI18n();
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<RunnerStatus>("offline");
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [jobs, setJobs] = useState<JobRequest[]>([]);
  const [myJobs, setMyJobs] = useState<JobRequest[]>([]);
  const [openJobs, setOpenJobs] = useState<JobRequest[]>([]);
  const [availableRunners, setAvailableRunners] = useState(0);
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [runnerRating, setRunnerRating] = useState<number | null>(null);
  const [reviews, setReviews] = useState<Record<string, Review | null>>({});
  const [toast, setToast] = useState<Toast>(null);
  const [loaded, setLoaded] = useState(false);
  const [servicesSaved, setServicesSaved] = useState(false);
  const [showRatingFor, setShowRatingFor] = useState<string | null>(null);
  const [approved, setApproved] = useState<boolean | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState<string | null>(null);
  const [goLiveBlocked, setGoLiveBlocked] = useState(false);

  // Refs mirror the availability-relevant state so the schedule heartbeat can
  // read the latest values without stale closures.
  const statusRef = useRef<RunnerStatus>("offline");
  const scheduleFromRef = useRef("");
  const scheduleToRef = useRef("");
  const approvedRef = useRef<boolean | null>(null);
  const setStatusAndRef = (value: RunnerStatus) => {
    statusRef.current = value;
    setStatus(value);
  };
  const setScheduleRef = (from: string, to: string) => {
    scheduleFromRef.current = from;
    scheduleToRef.current = to;
  };
  const setApprovedRef = (value: boolean | null) => {
    approvedRef.current = value;
    setApproved(value);
  };

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
        if (profile.status) setStatusAndRef(profile.status as RunnerStatus);
        setScheduleRef(profile.schedule_from ?? "", profile.schedule_to ?? "");
        setApprovedRef(profile.is_approved ?? true);
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
          // Auto-availability from the schedule: during the runner's set hours
          // (e.g. 8 AM–5 PM) they're online, outside them they're offline.
          // Unapproved runners can't go available, so skip the auto-online.
          const approved = profile?.is_approved ?? false;
          const autoOnline = isWithinSchedule(profile?.schedule_from ?? "", profile?.schedule_to ?? "");
          if (autoOnline && approved && profile?.status === "offline") {
            setStatusAndRef("available");
            await setAvailability("available");
          } else if (!autoOnline && profile?.status === "available") {
            setStatusAndRef("offline");
            await setAvailability("offline");
          }

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
      setToast({ kind: "error", message: res.message ?? t("common.errorJobUpdate") });
    }
  };

  const claimJob = async (job: JobRequest) => {
    const won = await claimBroadcast(job.id);
    if (won.ok) {
      const claimed: JobRequest = { ...job, status: "confirmed" };
      setOpenJobs((prev) => prev.filter((j) => j.id !== job.id));
      setJobs((prev) => [claimed, ...prev]);
      setToast({ kind: "claimed", job: claimed });
      // Price the broadcast now that THIS runner is assigned: the community
      // pays the claiming runner's price, so write it into the job notes so
      // both sides see the same total.
      const total = estimateJobTotal(claimed.serviceType, claimed.notes ?? "", services, claimed.takeFrom);
      if (total) {
        const res = await setJobTotal(claimed.id, total);
        if (res.ok) {
          const updated: JobRequest = {
            ...claimed,
            notes: (claimed.notes ?? "").includes("Total:")
              ? claimed.notes
              : `${claimed.notes ?? ""}\nTotal: ${total}`,
          };
          setJobs((prev) => prev.map((j) => (j.id === job.id ? updated : j)));
        }
      }
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
        // a claim/expiry (claimed broadcasts no longer match the filter), and
        // re-syncs assigned jobs so stats like Est. earned update on devices
        // where realtime is flaky (e.g. mobile browsers).
        pollInterval = setInterval(async () => {
          if (cancelled) return;
          const [opens, list] = await Promise.all([
            fetchOpenBroadcasts(),
            fetchJobsForRunner(uid),
          ]);
          setOpenJobs(opens);
          setJobs(list);
          loadContacts(list.map((j) => j.requesterId));
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
  // an "Available" runner isn't mistaken for stale and auto-offlined. Also
  // re-check the schedule so the runner flips online/offline as time passes.
  useEffect(() => {
    if (role !== "runner") return;
    const sync = async () => {
      await touchAvailability();
      const inWindow = isWithinSchedule(scheduleFromRef.current, scheduleToRef.current);
      if (inWindow && approvedRef.current && statusRef.current === "offline") {
        setStatusAndRef("available");
        await setAvailability("available");
      } else if (!inWindow && statusRef.current === "available") {
        setStatusAndRef("offline");
        await setAvailability("offline");
      }
    };
    sync();
    const id = setInterval(sync, 30000);
    return () => clearInterval(id);
  }, [role]);

  // Est. earned recomputes live from the jobs + services state (see
  // computeEarned), so it updates when a job is marked done on this screen
  // or arrives via realtime / the sync poll. Must live with the other hooks
  // (before any early return) so the hook count never changes between renders.
  const runnerEarned = useMemo(() => computeEarned(jobs, services), [jobs, services]);

  const setRunnerStatus = async (value: RunnerStatus) => {
    // Block going live without at least one service that has a price.
    if (value === "available") {
      const hasPricedService = services.some((s) => {
        if (!s.name.trim()) return false;
        if (s.pricing.model === "custom")
          return !!s.pricing.description?.trim();
        return typeof s.pricing.price === "number" && s.pricing.price > 0;
      });
      if (!hasPricedService) {
        setToast({ kind: "error", message: t("dash.run.goLiveBlockedBody") });
        setGoLiveBlocked(true);
        return;
      }
    }
    const prev = statusRef.current;
    setStatusAndRef(value);
    const res = await setAvailability(value);
    if (!res.ok) {
      setStatusAndRef(prev);
      setToast({ kind: "error", message: res.message ?? t("common.errorStatusUpdate") });
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
    if (goLiveBlocked && cleaned.some((s) => s.pricing.model === "custom"
      ? !!s.pricing.description?.trim()
      : typeof s.pricing.price === "number" && s.pricing.price > 0)) {
      setGoLiveBlocked(false);
    }
  };

  if (!loaded) {
    return (
      <PhoneFrame>
        <div className="text-center py-10 text-[12.5px] text-slate">{t("common.loading")}</div>
      </PhoneFrame>
    );
  }

  // ---------- Community view ----------
  if (role === "community") {
    const renderCommunityCard = (job: JobRequest) => {
      const contact = job.runnerId ? contacts[job.runnerId] : undefined;
      const review = reviews[job.id];
      const delivery = formatDelivery(job.deliverTo);
      const takeLines = formatTakeFromLines(job.takeFrom);
      return (
        <div key={job.id} className="bg-white border border-line rounded-[10px] px-3.5 py-3">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <Link href={`/job/${job.id}`} className="text-[15px] font-bold font-display break-words hover:text-teal transition-colors">
                {translateServiceName(t, job.serviceType)}
              </Link>
              <div className="mt-1.5 space-y-1 text-[12.5px]">
                <div className="leading-snug">
                  <span className="text-slate">{t("dash.com.takeFrom")}</span>{" "}
                  {takeLines.length === 0 ? (
                    <span className="text-ink break-words">{job.takeFrom || "—"}</span>
                  ) : (
                    <span className="inline-block align-top space-y-0.5">
                      {takeLines.map((l, i) => (
                        <span key={i} className="block">
                          {l}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
                <div className="leading-snug">
                  <span className="text-slate">{t("dash.com.receivedBy")}</span>{" "}
                  <span className="text-ink break-words">
                    {delivery.receiverName || "—"}
                  </span>
                </div>
                <div className="leading-snug">
                  <span className="text-slate">{t("dash.com.deliveredTo")}</span>{" "}
                  <span className="text-ink break-words">
                    {delivery.address}
                  </span>
                </div>
                <div className="leading-snug">
                  <span className="text-slate">{t("dash.com.runner")}</span>{" "}
                  <span className="text-ink break-words">
                    {contact?.name ?? (job.runnerId ? "…" : t("dash.com.broadcast"))}
                  </span>
                </div>
              </div>

              {parseNotes(job.notes ?? "").items.length > 0 && (
                <div className="rounded-[10px] bg-[#F0F7F4] border border-[#D7EBE1] px-3 py-2 mt-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-teal mb-1.5">
                    {t("itemlist.itemsOrdered")}
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
                  <span className="text-[11.5px] font-semibold text-teal">{t("dash.com.youPay")}</span>
                  <span className="font-mono font-bold text-[14px] text-teal">
                    {parseNotes(job.notes ?? "").total}
                  </span>
                </div>
              )}
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${JOB_STYLES[job.status]}`}
            >
              {t(`job.status.${job.status}`)}
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
              {t("dash.com.chatWith", { name: contact.name.split(" ")[0] })}
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
                  setToast({ kind: "error", message: res.message ?? t("common.errorCancel") });
                }
              }}
            >
              {confirmingCancel === job.id ? t("dash.com.confirmCancel") : t("dash.com.cancelRequest")}
            </Button>
          )}

          {job.status === "done" &&
            (review ? (
              <div className="mt-2.5 text-[12px] text-teal font-semibold">
                {t("dash.com.youRated", { rating: review.rating })} {review.text ? `— "${review.text}"` : ""}
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
              {t("dash.com.requestAgain")}
            </Link>
          )}
        </div>
      );
    };
    return (
      <PhoneFrame>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <div className="text-[19px] md:text-[24px] font-bold font-display">{t("dash.com.findHelp")}</div>
          <RoleBadge role="community" />
        </div>
        <div className="text-[12.5px] text-slate mb-4.5">
          {greeting(t)}, {name?.split(" ")[0] || "neighbour"} · {area || t("browse.yourArea")}
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
                {t("common.ok")}
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
                      t("dash.toast.accepted", { name: toast.contact?.name ?? "Your runner" })}
                    {toast.kind === "done" && t("dash.toast.done")}
                    {toast.kind === "expired" && t("dash.toast.expired")}
                    {toast.kind === "cancelled" && t("dash.toast.cancelled")}
                    {toast.kind === "new" && t("dash.toast.sent")}
                  </div>
                  <div className="text-[11.5px] text-slate mt-0.5">
                    {toast.kind !== "cancelled" && toast.job.serviceType && (
                      <>
                        <span className="text-teal font-semibold">
                          {translateServiceName(t, toast.job.serviceType)}
                        </span>
                        <span className="mx-1.5 text-line">·</span>
                        {toast.job.takeFrom} → {toast.job.deliverTo}
                      </>
                    )}
                    {toast.kind === "accepted" && toast.contact?.whatsapp
                      ? t("dash.toast.reachWhatsApp")
                      : toast.kind === "done"
                      ? t("dash.toast.rateRunner")
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
                ★ {t("job.rateRunner")}
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="bg-white border border-line rounded-[10px] p-3 text-center">
            <div className="font-mono font-semibold text-[17px] md:text-[20px]">{myJobs.length}</div>
            <div className="text-[9.5px] text-slate uppercase tracking-wide mt-0.5">{t("dash.com.totalRequests")}</div>
          </div>
          <div className="bg-white border border-line rounded-[10px] p-3 text-center">
            <div className="font-mono font-semibold text-[17px] md:text-[20px] text-teal">
              {myJobs.filter((j) => j.status === "done").length}
            </div>
            <div className="text-[9.5px] text-slate uppercase tracking-wide mt-0.5">{t("dash.com.completed")}</div>
          </div>
          <div className="bg-white border border-line rounded-[10px] p-3 text-center">
            <div className="font-mono font-semibold text-[17px] md:text-[20px] text-orange">
              {myJobs.filter((j) => j.status === "pending" || j.status === "confirmed").length}
            </div>
            <div className="text-[9.5px] text-slate uppercase tracking-wide mt-0.5">{t("dash.com.inProgress")}</div>
          </div>
        </div>

        {/* Quick request — pick a service first */}
        <div className="text-[11px] font-mono uppercase tracking-wide text-ink mb-2">
          {t("dash.com.whatNeed")}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-5">
          {QUICK_SERVICES.map((svc) => (
            <Link
              key={svc.label}
              href={`/broadcast${svc.value ? `?service=${encodeURIComponent(svc.value)}` : ""}`}
              className="bg-white border border-line rounded-[12px] p-3 text-center hover:border-orange transition-colors"
            >
              <div className="text-xl mb-1">{svc.emoji}</div>
              <div className="text-[12px] font-semibold">{t(svc.tKey)}</div>
            </Link>
          ))}
        </div>

        {/* Available runners nearby */}
        <div className="flex items-center justify-between gap-3 bg-[#E4F3EC] border border-[#C8E6DA] rounded-card px-3.5 py-3 mb-5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-teal inline-block flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-teal">
                {t("dash.com.runnersAvailable", { n: availableRunners, s: availableRunners === 1 ? "" : "s" })}
              </div>
              <div className="text-[11px] text-slate">
                {t("dash.com.runnersAvailableSub", { area: area || t("browse.yourArea") })}
              </div>
            </div>
          </div>
          <Link href="/browse" className="shrink-0">
            <span className="inline-block bg-teal text-white rounded-[10px] px-3.5 py-2 text-[12px] font-semibold">
              {t("dash.com.viewRunners")}
            </span>
          </Link>
        </div>

        {/* Your requests */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-mono uppercase tracking-wide text-ink">
            {t("dash.com.yourRequests")}
          </div>
          <Link href="/history" className="text-[11px] font-semibold text-teal hover:underline">
            {t("dash.com.history")}
          </Link>
        </div>
        {(() => {
          const active = myJobs.filter(
            (j) => j.status === "pending" || j.status === "confirmed"
          );
          const past = myJobs.filter(
            (j) => j.status === "done" || j.status === "cancelled" || j.status === "expired"
          );
          if (myJobs.length === 0) {
            return (
          <div className="text-center bg-white border border-dashed border-line rounded-card px-5 py-8 mb-3.5">
            <div className="text-2xl mb-2">📦</div>
            <div className="font-display font-bold text-[14.5px] mb-1">{t("dash.com.noRequests")}</div>
            <div className="text-[12px] text-slate leading-relaxed mb-4">
              {t("dash.com.noRequestsBody")}
            </div>
            <Link href="/browse" className="block">
              <Button variant="outline">{t("common.findRunner")}</Button>
            </Link>
          </div>
            );
          }
          return (
            <>
          {active.length > 0 && (
          <div className="grid gap-2.5 md:grid-cols-2">
          {active.map(renderCommunityCard)}
          </div>
          )}
          {active.length === 0 && (
            <div className="text-center bg-paper2 border border-dashed border-line rounded-card px-4 py-6 mb-3.5">
              <div className="text-[13px] font-semibold text-ink">{t("dash.com.noActive")}</div>
              <div className="text-[11.5px] text-slate mt-0.5">
                {t("dash.com.noActiveBody")}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div className="mt-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10.5px] font-mono uppercase tracking-wide text-slate">{t("dash.com.recent")}</span>
                <Link href="/history" className="text-[11px] font-semibold text-teal hover:underline">
                  {t("common.viewAll")}
                </Link>
              </div>
              <div className="grid gap-2.5 md:grid-cols-2">
                {past.slice(0, 3).map(renderCommunityCard)}
              </div>
            </div>
          )}
            </>
          );
        })()}

        <div className="text-[11.5px] text-slate bg-paper2 rounded-lg px-3 py-2.5 mt-3.5 italic">
          {t("dash.com.wantEarn")}
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

  const renderRunnerCard = (job: JobRequest) => {
    const contact = job.requesterId ? contacts[job.requesterId] : undefined;
    const review = reviews[job.id];
    const delivery = formatDelivery(job.deliverTo);
    const takeLines = formatTakeFromLines(job.takeFrom);
    const takeFromDisplay =
      takeLines.length > 0 ? (
        <span className="block space-y-0.5">
          {takeLines.map((l, i) => (
            <span key={i} className="block">
              {l}
            </span>
          ))}
        </span>
      ) : (
        job.takeFrom || "—"
      );
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
              {translateServiceName(t, job.serviceType)}
            </Link>
          </div>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${JOB_STYLES[job.status]}`}
          >
            {t(`job.status.${job.status}`)}
          </span>
        </div>

        <div className="px-3.5 py-3">
          {/* Detail tiles */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <JobInfoTile label={t("dash.run.pickupTile")} value={takeFromDisplay} />
            <JobInfoTile label={t("dash.run.deliveryTile")} value={delivery.address} />
            <JobInfoTile label={t("dash.run.receivedByTile")} value={delivery.receiverName || "—"} />
            <JobInfoTile label={t("dash.run.neededBy")} value={neededBy ?? "—"} />
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
          <ItemList items={items} title={t("itemlist.title")} />
          {total && (
            <div className="flex items-center justify-between rounded-[10px] bg-[#E4F3EC] border border-[#C8E6DA] px-3 py-2 mt-2.5">
              <span className="text-[11.5px] font-semibold text-teal">{t("dash.run.communityPays")}</span>
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
                {t("dash.run.acceptJob")}
              </Button>
              <Button
                variant="outline"
                className="flex-1 px-3 py-2 text-[11.5px] rounded-lg"
                onClick={() => changeJobStatus(job, "cancelled")}
              >
                {t("dash.run.decline")}
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
                    {review.rating}/5 {t("dash.run.from")} {review.authorName}
                  </div>
                  {review.text ? (
                    <div className="text-[12px] text-[#4B5250] italic mt-1">
                      &quot;{review.text}&quot;
                    </div>
                  ) : (
                    <div className="text-[12px] text-[#4B5250] mt-1">
                      {t("dash.run.noMessage")}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowRatingFor(job.id)}
                  className="w-full rounded-[10px] px-4 py-2 text-[12px] font-semibold text-center inline-flex items-center justify-center gap-1.5 bg-[#FDF6E3] text-[#8A6D00] border border-[#F0E0A8] hover:bg-yellow/20 transition-colors"
                >
                  {t("dash.run.viewRating", {
                    name: contact?.name?.split(" ")[0] ?? review.authorName ?? "community",
                  })}
                </button>
              )
            ) : (
              <div className="text-center text-[12px] text-slate italic">
                {t("dash.run.noRatingYet")}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <PhoneFrame>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <div className="text-[19px] md:text-[24px] font-bold font-display">
          {greeting(t)}, {name?.split(" ")[0] || "runner"}
        </div>
        <RoleBadge role="runner" />
      </div>
      <div className="text-[12.5px] text-slate mb-4.5">
        {area || t("browse.yourArea")}
      </div>

      {approved === false && (
        <div className="bg-[#FDF6E3] border border-[#F0E0A8] rounded-card px-3.5 py-3 mb-4">
          <div className="text-[13px] font-bold text-[#8A6D00]">{t("dash.run.awaitingApproval")}</div>
          <div className="text-[11.5px] text-slate mt-0.5 leading-snug">
            {t("dash.run.awaitingApprovalBody")}
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
                {status === "available" ? t("dash.run.youAreAvailable") : t("dash.run.youAreOffline")}
              </div>
              <div
                className={`text-[11.5px] ${
                  status === "available" ? "text-slate" : "text-[#B8BDB9]"
                }`}
              >
                {status === "available"
                  ? t("dash.run.youCanReceive")
                  : t("dash.run.wontReceive")}
              </div>
            </div>
          </div>
          <Button
            variant={status === "available" ? "secondary" : "primary"}
            className="w-auto px-4 py-2 text-[12px]"
            onClick={() => setRunnerStatus(status === "available" ? "offline" : "available")}
          >
            {status === "available" ? t("dash.run.goOffline") : t("dash.run.goAvailable")}
          </Button>
        </div>
      </div>

      {goLiveBlocked && (
        <div className="rounded-[10px] border border-orange/40 bg-[#FDEFE3] px-3.5 py-3 mb-4">
          <div className="text-[12.5px] font-bold text-orange mb-0.5">{t("dash.run.goLiveBlockedTitle")}</div>
          <div className="text-[11.5px] text-slate leading-snug">{t("dash.run.goLiveBlockedBody")}</div>
          <button
            onClick={() => setGoLiveBlocked(false)}
            className="mt-2 text-[11px] font-semibold text-orange underline"
          >
            {t("common.ok")}
          </button>
        </div>
      )}

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
                  {toast.kind === "broadcast" ? t("dash.run.newBroadcastToast") : t("dash.run.newRequestToast")}
                </div>
                <div className="text-[11.5px] text-slate mt-0.5">
                  <span className="text-orange font-semibold">{translateServiceName(t, toast.job.serviceType)}</span>
                  <span className="mx-1.5 text-line">·</span>
                  {toast.job.takeFrom} → {toast.job.deliverTo}
                  {toast.kind === "broadcast" && (
                    <span className="block mt-1 text-[10.5px] text-slate">
                      {t("dash.run.openToAll")}
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
                if (toast.kind === "broadcast") {
                  claimJob(toast.job);
                } else {
                  changeJobStatus(toast.job, "confirmed");
                }
                setToast(null);
              }}
            >
              {toast.kind === "broadcast" ? t("dash.run.claim") : t("dash.run.accept")}
            </Button>
            <Button
              variant="outline"
              className="w-auto px-3 py-2 text-[11.5px] rounded-[10px]"
              onClick={() => setToast(null)}
            >
              {toast.kind === "broadcast" ? t("dash.run.pass") : t("dash.run.decline")}
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
              {t("common.ok")}
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
              <div className="text-[13.5px] font-bold text-ink">{t("dash.run.gotJob")}</div>
              <div className="text-[11.5px] text-slate mt-0.5">
                <span className="text-teal font-semibold">{translateServiceName(t, toast.job.serviceType)}</span>
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
              {t("common.ok")}
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
              <div className="text-[13.5px] font-bold text-ink">{t("dash.run.justMissed")}</div>
              <div className="text-[11.5px] text-slate mt-0.5">
                {t("dash.run.justMissedBody")}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3.5">
            <Button
              variant="outline"
              className="w-auto px-4 py-2 text-[11.5px] rounded-[10px]"
              onClick={() => setToast(null)}
            >
              {t("common.ok")}
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
                {t("dash.run.currentJob")}
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full whitespace-nowrap bg-[#F0F8F5] text-teal">
                {t("job.status.confirmed")}
              </span>
            </div>
            <div className="text-[15px] font-bold font-display">{translateServiceName(t, active.serviceType)}</div>
            <RouteInfo job={active} variant="current" />
            {noteData.services.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {noteData.services.map((s, i) => (
                  <span
                    key={i}
                    className="text-[10.5px] font-mono px-2 py-0.5 rounded-full bg-[#FDF3EE] text-orange border border-[#F5D5C4] whitespace-nowrap"
                  >
                    + {translateServiceName(t, s)}
                  </span>
                ))}
              </div>
            )}
            <ItemList items={noteData.items} title={t("itemlist.title")} />
            {noteData.total && (
              <div className="flex items-center justify-between rounded-[10px] bg-[#E4F3EC] border border-[#C8E6DA] px-3 py-2 mt-2.5">
                <span className="text-[11.5px] font-semibold text-teal">{t("dash.run.communityPays")}</span>
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
                {t("dash.run.requestedBy", { name: contact.name })}
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
                {t("dash.run.markAsDone")}
              </Button>
            </div>
          </div>
        );
      })()}

      <div className="text-[11px] font-mono uppercase tracking-wide text-ink mb-2">
        {t("dash.run.openRequests")}
      </div>
      {(() => {
        const live = openJobs.filter((j) => Date.now() - j.createdAt < 5 * 60 * 1000);
        return live.length === 0 ? (
        <div className="bg-white border border-dashed border-line rounded-card px-4 py-5 mb-4 text-center">
          <div className="text-xl mb-1.5">📣</div>
          <div className="font-display font-bold text-[13.5px] mb-0.5">{t("dash.run.noBroadcasts")}</div>
          <div className="text-[11.5px] text-slate">
            {t("dash.run.noBroadcastsBody")}
          </div>
        </div>
        ) : (
        <div className="grid gap-2.5 mb-4 md:grid-cols-2 lg:grid-cols-3">
          {live.map((job) => {
            const bNotes = parseNotes(job.notes ?? "");
            const minsLeft = Math.max(0, 5 - Math.floor((Date.now() - job.createdAt) / 60000));
            return (
            <div key={job.id} className="bg-white border border-line rounded-card overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 border-b bg-[#FDF6E3] border-[#F0E0A8]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[17px] leading-none flex-shrink-0">📣</span>
                  <span className="text-[13.5px] font-bold font-display text-ink break-words">
                    {translateServiceName(t, job.serviceType)}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 bg-[#F0F8F5] text-teal">
                  {t("dash.run.minutesLeft", { n: minsLeft })}
                </span>
              </div>
              <div className="px-3.5 py-3">
                <RouteInfo job={job} />
                <ItemList items={bNotes.items} title={t("itemlist.itemsOrdered")} />
                {bNotes.extra.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {bNotes.extra.map((line, i) => (
                      <div key={i} className="text-[11px] text-[#4B5250] leading-snug break-words">
                        {line}
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  variant="secondary"
                  className="w-full px-3 py-2 text-[12px] rounded-lg mt-2.5"
                  onClick={() => claimJob(job)}
                >
                  {t("dash.run.claim")}
                </Button>
              </div>
            </div>
            );
          })}
        </div>
        );
      })()}

      <div className="md:grid md:grid-cols-2 md:gap-6 md:items-start">
      <div className="min-w-0">
      <div className="text-[11px] font-mono uppercase tracking-wide text-ink mb-2">
        {t("dash.run.yourStatus")}
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
            {t(`status.${opt.value}`)}
          </button>
        ))}
      </div>

      <div className="text-[11px] font-mono uppercase tracking-wide text-ink mb-2">
        {t("dash.run.myPerformance")}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-[#FDF6E3] border border-[#F0E0A8] rounded-[10px] p-3 text-center">
          <div className="font-mono font-bold text-[18px] text-[#8A6D00]">
            ⭐ {runnerRating ?? t("runcard.new")}
          </div>
          <div className="text-[9px] text-slate uppercase tracking-wide mt-0.5">{t("dash.run.rating")}</div>
        </div>
        <div className="bg-[#E4F3EC] border border-[#C8E6DA] rounded-[10px] p-3 text-center">
          <div className="font-mono font-bold text-[18px] text-teal">✓ {doneCount}</div>
          <div className="text-[9px] text-slate uppercase tracking-wide mt-0.5">{t("dash.run.jobsDone")}</div>
        </div>
        <div className="bg-paper2 rounded-[10px] p-3 text-center">
          <div className="font-mono font-bold text-[18px]">
            {completionRate !== null ? `${completionRate}%` : "—"}
          </div>
          <div className="text-[9px] text-slate uppercase tracking-wide mt-0.5">{t("dash.run.completion")}</div>
        </div>
        <div className="bg-white border border-line rounded-[10px] p-3 text-center">
          <div className="font-mono font-bold text-[18px] text-orange">{liveOpenCount}</div>
          <div className="text-[9px] text-slate uppercase tracking-wide mt-0.5">{t("dash.run.openNow")}</div>
        </div>
      </div>

      <div className="flex items-center justify-between bg-white border border-line rounded-[10px] px-3 py-2.5 mb-4">
        <span className="text-[11.5px] text-slate">{t("dash.run.estEarned")}</span>
        <span className="font-mono font-bold text-[14px]">{formatRM(runnerEarned)}</span>
      </div>

      <div className="text-[11px] font-mono uppercase tracking-wide text-ink mt-4 mb-2">
        {t("dash.run.yourServices")}
      </div>
      {services.length === 0 && (
        <div className="rounded-[10px] border border-orange/30 bg-[#FDF3EE] px-3.5 py-3 mb-3">
          <div className="text-[12px] font-bold text-orange mb-0.5">{t("dash.run.servicesReminderTitle")}</div>
          <div className="text-[11.5px] text-slate leading-snug">{t("dash.run.servicesReminderBody")}</div>
        </div>
      )}
      <div className="grid gap-2.5">
      {services.map((svc) => {
        const isOther = !SERVICE_PRESETS.some(
          (p) => p.toLowerCase() === svc.name.toLowerCase()
        );
        return (
          <div key={svc.id} className="bg-white border border-line rounded-[10px] p-3">
            <div className="mb-2">
              <label className="text-[10px] font-semibold text-slate block mb-1">
                {t("dash.run.serviceName")}
              </label>
              <ServicePicker
                value={
                  isOther
                    ? OTHER_SERVICE
                    : (SERVICE_PRESETS.find(
                        (p) => p.toLowerCase() === svc.name.toLowerCase()
                      ) ?? svc.name)
                }
                onChange={(name) => updateService(svc.id, { name: name === OTHER_SERVICE ? "" : name })}
              />
              {isOther && (
                <>
                  <input
                    className="w-full bg-white border border-line rounded-[10px] px-3 py-2 text-[12.5px] mt-1.5"
                    placeholder={t("dash.run.writeOwn")}
                    value={svc.name}
                    onChange={(e) => updateService(svc.id, { name: e.target.value })}
                  />
                  <div className="text-[10.5px] text-slate mt-1">
                    {t("dash.run.noCourierNames")}
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-start">
              <select
                className="bg-white border border-line rounded-[10px] px-2 py-2 text-[12px] max-w-full"
                value={svc.pricing.model}
                onChange={(e) =>
                  updatePricing(svc.id, {
                    model: e.target.value as Service["pricing"]["model"],
                  })
                }
              >
                <option value="flat_rate">{t("dash.run.flatRate")}</option>
                <option value="per_item">{t("dash.run.perItem")}</option>
                <option value="custom">{t("dash.run.custom")}</option>
              </select>
              {svc.pricing.model === "custom" ? (
                <input
                  className="flex-1 bg-white border border-line rounded-[10px] px-3 py-2 text-[12.5px]"
                  placeholder={t("dash.run.customPlaceholder")}
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
                    inputMode="decimal"
                    className="flex-1 bg-transparent py-2 text-[12.5px] min-w-0"
                    placeholder="0"
                    value={svc.pricing.price ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      updatePricing(svc.id, {
                        price: raw === "" ? undefined : Number(raw),
                      });
                    }}
                  />
                </div>
              )}
              <button
                onClick={() =>
                  setServices((prev) => prev.filter((s) => s.id !== svc.id))
                }
                className="text-[11px] text-orange font-semibold px-2 py-2"
              >
                {t("common.remove")}
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
          {t("dash.run.addService")}
        </Button>
        <Button variant="secondary" className="w-auto px-3 py-2 text-[12px]" onClick={saveServices}>
          {t("dash.run.saveServices")}
        </Button>
        {servicesSaved && <span className="text-[11px] text-teal font-semibold">{t("common.saved")}</span>}
      </div>
      <div className="text-[11.5px] text-slate bg-paper2 rounded-lg px-3 py-2.5 italic">
        {t("dash.run.servicesNote")}
      </div>
      </div>

      <div className="min-w-0">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-mono uppercase tracking-wide text-ink">
          {t("dash.run.recentJobs")}
        </div>
        <Link href="/history" className="text-[11px] font-semibold text-teal hover:underline">
          {t("common.viewAll")}
        </Link>
      </div>
      {(() => {
        const pending = jobs.filter((j) => j.status === "pending");
        const done = jobs.filter((j) => j.status === "done");
        if (jobs.length === 0) {
          return (
        <div className="text-center bg-white border border-dashed border-line rounded-card px-5 py-8 mb-3.5">
          <div className="text-2xl mb-2">📭</div>
          <div className="font-display font-bold text-[14.5px] mb-1">{t("dash.run.noJobs")}</div>
          <div className="text-[12px] text-slate leading-relaxed">
            {t("dash.run.noJobsBody")}
          </div>
        </div>
          );
        }
        return (
          <>
        {pending.length > 0 && (
        <div className="grid gap-2.5 md:grid-cols-2 mb-3.5">
        {pending.map(renderRunnerCard)}
        </div>
        )}
        {done.length > 0 && (
        <div className="grid gap-2.5 md:grid-cols-2">
        {done.slice(0, 3).map(renderRunnerCard)}
        </div>
        )}
          </>
        );
      })()}
      </div>
      </div>
    </PhoneFrame>
  );
}
