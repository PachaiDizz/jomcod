"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PhoneFrame from "@/components/PhoneFrame";
import Button from "@/components/Button";
import LoadingState from "@/components/LoadingState";
import ItemList from "@/components/ItemList";
import RouteInfo from "@/components/RouteInfo";
import { normalizePrice, serviceEmoji, titleCase, waLink } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import {
  acceptJob,
  addReview,
  cancelJob,
  claimBroadcast,
  declineJob,
  fetchContact,
  fetchJobById,
  fetchReviewForJob,
  markJobDone,
  setJobTotal,
} from "@/lib/queries";
import { estimateJobTotal } from "@/lib/estimate";
import type { JobRequest, Review } from "@/lib/types";

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

const JOB_ACCENT: Record<JobRequest["status"], string> = {
  pending: "bg-[#E7C86A]",
  confirmed: "bg-orange",
  done: "bg-teal",
  expired: "bg-[#9AA09C]",
  cancelled: "bg-[#B5B8B5]",
};

function parseItems(notes: string): string[] {
  const items: string[] = [];
  for (const line of notes.split("\n")) {
    const m = line.match(/^Items:\s*(.*)$/i);
    if (m) {
      for (const part of m[1].split(",")) {
        const t = part.trim();
        if (t) items.push(t);
      }
    }
  }
  return items;
}

function parseNotesExtended(notes: string): {
  services: string[];
  items: string[];
  total: string | null;
  other: string[];
} {
  const services: string[] = [];
  const items: string[] = [];
  let total: string | null = null;
  const other: string[] = [];
  for (const line of notes.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const sm = t.match(/^Service:\s*(.+)$/i);
    const im = t.match(/^Items:\s*(.+)$/i);
    const tm = t.match(/^Total:\s*(.+)$/i);
    if (sm) services.push(sm[1]!.trim());
    else if (im) {
      for (const part of im[1]!.split(",")) {
        const p = part.trim();
        if (!p) continue;
        // Normalize any legacy "@ RM03" style price inside the item text.
        items.push(p.replace(/(RM\s*[\d.]+)/gi, (_, r) => normalizePrice(r)));
      }
    } else if (tm) total = tm[1]!.trim();
    else if (!/^Needed By:/i.test(t)) other.push(t);
  }
  return { services, items, total, other };
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<JobRequest | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [role, setRole] = useState("");
  const [uid, setUid] = useState("");
  const [contact, setContact] = useState<{ name: string; whatsapp: string } | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [myServices, setMyServices] = useState<import("@/lib/types").Service[]>([]);
  const [rating, setRating] = useState(0);
  const [ratingText, setRatingText] = useState("");
  const [savingRating, setSavingRating] = useState(false);
  const [ratingMsg, setRatingMsg] = useState("");

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await createClient().auth.getUser();
      if (!active) return;
      setUid(user?.id ?? "");
      setRole((user?.user_metadata?.role as string) ?? "");

      const j = await fetchJobById(String(id));
      if (!active) return;
      if (!j) {
        setNotFound(true);
        setLoaded(true);
        return;
      }
      setJob(j);

      const otherId = user && j.requesterId === user.id ? j.runnerId : j.requesterId;
      if (otherId) {
        const c = await fetchContact(otherId);
        if (active) setContact(c ? { name: c.name, whatsapp: c.whatsapp } : null);
      }
      const r = await fetchReviewForJob(j.id);
      if (active) setReview(r);

      // A runner viewing this page needs their own services to price a
      // broadcast they're about to claim.
      if ((user?.user_metadata?.role as string) === "runner") {
        const { getProfile } = await import("@/lib/queries");
        const profile = await getProfile();
        if (active && profile) {
          setMyServices(
            (Array.isArray(profile.services) ? (profile.services as import("@/lib/types").Service[]) : [])
          );
        }
      }
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const isRequester = uid !== "" && job?.requesterId === uid;
  const isRunner = uid !== "" && job?.runnerId === uid;
  // An open broadcast: assigned to no runner yet, still pending.
  const isOpenBroadcast =
    role === "runner" && !!job && !job.runnerId && job.status === "pending" && !isRequester;

  const act = async (fn: () => Promise<{ ok: boolean; message?: string }>, next: JobRequest["status"]) => {
    setError("");
    const res = await fn();
    if (res.ok && job) {
      setJob({ ...job, status: next });
      setConfirming(false);
    } else {
      setError(res.message ?? "Something went wrong. Try again.");
    }
  };

  const submitRating = async () => {
    if (!job || rating < 1) return;
    setSavingRating(true);
    setRatingMsg("");
    const res = await addReview({ jobId: job.id, runnerId: job.runnerId ?? "", rating, text: ratingText });
    setSavingRating(false);
    if (res.ok) {
      setReview({ id: "local", authorName: "You", rating, text: ratingText });
      setRatingMsg("Saved ✓");
    } else {
      setRatingMsg(res.message ?? "Couldn't save your rating.");
    }
  };

  const handleClaim = async () => {
    if (!job) return;
    setError("");
    setClaiming(true);
    const res = await claimBroadcast(job.id);
    if (res.ok) {
      const total = estimateJobTotal(job.serviceType, job.notes ?? "", myServices, job.takeFrom);
      if (total) await setJobTotal(job.id, total);
      setJob({ ...job, status: "confirmed", notes: job.notes ?? "" });
      setClaiming(false);
    } else {
      setClaiming(false);
      setError(res.message ?? "Another runner got this one first.");
    }
  };

  const wa = waLink(contact?.whatsapp);

  if (!loaded) {
    return (
      <PhoneFrame>
        <LoadingState label="Loading job…" />
      </PhoneFrame>
    );
  }

  if (notFound || !job) {
    return (
      <PhoneFrame>
        <div className="text-[19px] font-bold mb-1 font-display">Job not found</div>
        <div className="text-[12.5px] text-slate mb-4.5">
          This job doesn&apos;t exist or you&apos;re not part of it.
        </div>
        <Link href="/dashboard" className="w-full block">
          <Button variant="outline">Back to dashboard</Button>
        </Link>
      </PhoneFrame>
    );
  }

  const { services, items, total, other: otherLines } = parseNotesExtended(job.notes ?? "");

  return (
    <PhoneFrame>
      <Link href="/dashboard" className="text-[11.5px] font-semibold text-teal hover:underline mb-3 inline-block">
        ← Dashboard
      </Link>

      <div className="bg-white border border-line rounded-card overflow-hidden mb-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className={`h-1.5 ${JOB_ACCENT[job.status]}`} />
        <div className="px-4 py-3.5 flex items-center justify-between gap-2 border-b border-line">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-10 h-10 rounded-[12px] bg-paper2 flex items-center justify-center text-[20px] flex-shrink-0">
              {serviceEmoji(job.serviceType)}
            </span>
            <div className="min-w-0">
              <div className="text-[16px] font-bold font-display break-words">
                {titleCase(job.serviceType)}
              </div>
              {contact?.name && (
                <div className="text-[11.5px] text-slate truncate">
                  {isRequester ? `Runner: ${contact.name}` : `Requested by ${contact.name}`}
                </div>
              )}
            </div>
          </div>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${JOB_STYLES[job.status]}`}>
            {JOB_LABELS[job.status]}
          </span>
        </div>

        <div className="px-4 py-3.5 space-y-2.5">
          <RouteInfo job={job} />

          <div className="flex items-center justify-between gap-2 rounded-[10px] bg-paper2 border border-line px-3 py-2">
            <span className="text-[11px] font-semibold text-slate">Created</span>
            <span className="text-[12px] text-ink font-medium">
              {new Date(job.createdAt).toLocaleString("en-MY", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          {services.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {services.map((s, i) => (
                <span key={i} className="text-[10.5px] font-mono px-2 py-0.5 rounded-full bg-[#FDF3EE] text-orange border border-[#F5D5C4] whitespace-nowrap">
                  + {s}
                </span>
              ))}
            </div>
          )}
          {items.length > 0 && (
            <ItemList items={items.map((it) => {
              const m = it.match(/^(.*?)\s*[×x*]\s*([\d.]+)\s*(?:@\s*(RM[\d.]+))?/i);
              if (m) return { name: m[1]!.trim(), qty: m[2]!.trim(), price: m[3]?.trim() ?? "" };
              return { name: it, qty: "", price: "" };
            })} title="What to buy / pick up" />
          )}
          {total && (
            <div className="flex items-center justify-between rounded-[10px] bg-[#E4F3EC] border border-[#C8E6DA] px-3.5 py-2.5 mt-1">
              <span className="text-[12px] font-semibold text-teal">Estimated total</span>
              <span className="font-mono font-bold text-[15px] text-teal">{total}</span>
            </div>
          )}
          {otherLines.length > 0 && (
            <div className="text-[12.5px] text-[#4B5250] italic border-t border-line pt-2.5 space-y-1">
              {otherLines.map((l, i) => (
                <div key={i} className="break-words">{l}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="text-[12px] text-orange bg-[#FDEFE3] rounded-[10px] px-3 py-2 mb-3">{error}</div>
      )}

      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-3 w-full rounded-[10px] px-4 py-3 text-[13px] font-semibold text-center inline-flex items-center justify-center gap-2 bg-[#25D366] text-white hover:opacity-90"
        >
          💬 Chat on WhatsApp
        </a>
      )}

      {isOpenBroadcast && (
        <Button
          className="w-full mb-3"
          onClick={handleClaim}
          disabled={claiming}
        >
          {claiming ? "Claiming…" : "⚡ Claim this job"}
        </Button>
      )}

      {isRunner && job.status === "pending" && (
        <div className="flex gap-2 mb-3">
          <Button className="flex-1" onClick={() => act(() => acceptJob(job.id), "confirmed")}>
            Accept job
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => act(() => declineJob(job.id), "cancelled")}>
            Decline
          </Button>
        </div>
      )}

      {isRunner && job.status === "confirmed" && (
        <Button className="w-full mb-3" onClick={() => act(() => markJobDone(job.id), "done")}>
          ✓ Mark as done
        </Button>
      )}

      {isRequester && (job.status === "pending" || job.status === "confirmed") && (
        <Button
          variant={confirming ? "primary" : "outline"}
          className="w-full mb-3"
          onClick={() => {
            if (!confirming) {
              setConfirming(true);
              setTimeout(() => setConfirming(false), 4000);
              return;
            }
            act(() => cancelJob(job.id), "cancelled");
          }}
        >
          {confirming ? "Tap again to confirm cancel" : "Cancel request"}
        </Button>
      )}

      {isRequester && job.status === "done" && review && (
        <div className="mb-3 bg-[#FDF6E3] border border-[#F0E0A8] rounded-[10px] px-3.5 py-3 text-[12.5px]">
          <span className="text-yellow font-semibold">{"★".repeat(review.rating)}</span> You rated {review.rating}/5
          {review.text ? ` — "${review.text}"` : ""}
        </div>
      )}

      {isRequester && job.status === "done" && !review && (
        <div className="mb-3 bg-[#FDF6E3] border border-[#F0E0A8] rounded-[10px] px-3.5 py-3">
          <div className="text-[12px] font-semibold mb-2">Rate your runner</div>
          <div className="flex gap-1 mb-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRating(n)}
                className={`text-lg leading-none ${n <= rating ? "text-yellow" : "text-[#D8D2BE]"}`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            className="w-full bg-white border border-line rounded-[10px] px-3 py-2 text-[12.5px] min-h-[54px] mb-2"
            placeholder="How was the service? (optional)"
            value={ratingText}
            onChange={(e) => setRatingText(e.target.value)}
          />
          <Button variant="secondary" className="w-auto px-3 py-1.5 text-[11.5px] rounded-lg" onClick={submitRating} disabled={savingRating || rating < 1}>
            {savingRating ? "Submitting…" : "Submit rating"}
          </Button>
          {ratingMsg && <div className="text-[11.5px] mt-2">{ratingMsg}</div>}
        </div>
      )}

      {isRequester && job.status === "done" && (
        <Link
          href={`/request?runner=${job.runnerId ?? ""}&service=${encodeURIComponent(job.serviceType)}&take=${encodeURIComponent(job.takeFrom)}&notes=${encodeURIComponent(job.notes ?? "")}`}
          className="block w-full rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold text-center bg-orange/10 text-orange border border-orange/30 hover:bg-orange hover:text-white transition-colors"
        >
          🔄 Request again
        </Link>
      )}
    </PhoneFrame>
  );
}
