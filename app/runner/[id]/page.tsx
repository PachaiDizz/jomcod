"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PhoneFrame from "@/components/PhoneFrame";
import StatusPill from "@/components/StatusPill";
import Button from "@/components/Button";
import LoadingState from "@/components/LoadingState";
import { cleanServiceName, formatRM, titleCase } from "@/lib/constants";
import { pricingLabel } from "@/lib/mockData";
import {
  blockUser,
  fetchBlockedIds,
  fetchContact,
  fetchReviewsForRunner,
  fetchRunnerById,
  submitReport,
  unblockUser,
} from "@/lib/queries";
import { waLink } from "@/lib/constants";
import type { Review, Runner } from "@/lib/types";

const REPORT_REASONS = [
  "Fake runner",
  "No response",
  "Abusive behaviour",
  "Fraud / scam",
  "Wrong service",
  "Inappropriate content",
  "Other",
];

export default function RunnerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [runner, setRunner] = useState<Runner | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [contactWhatsApp, setContactWhatsApp] = useState<string | null>(null);
  const [contactLoaded, setContactLoaded] = useState(false);
  const [blocked, setBlocked] = useState<boolean | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportMsg, setReportMsg] = useState("");
  const [reporting, setReporting] = useState(false);
  const [blocking, setBlocking] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    fetchRunnerById(String(id)).then((r) => {
      if (!active) return;
      if (r) {
        setRunner(r);
        fetchReviewsForRunner(r.id).then((list) => {
          if (!active) return;
          setReviews(list);
          if (list.length > 0) {
            setAvgRating(
              Math.round((list.reduce((sum, x) => sum + x.rating, 0) / list.length) * 10) / 10
            );
          }
        });
        // WhatsApp is gated server-side: it's only shared after the viewer
        // shares an accepted/completed job with this runner.
        fetchContact(r.id).then((c) => {
          if (!active) return;
          setContactWhatsApp(c?.whatsapp ? c.whatsapp : null);
          setContactLoaded(true);
        });
        fetchBlockedIds().then((ids) => {
          if (!active) return;
          setBlocked(ids.includes(r.id));
        });
      } else {
        setNotFound(true);
      }
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (notFound) {
    return (
      <PhoneFrame>
        <div className="text-[19px] font-bold mb-1 font-display">Runner not found</div>
        <div className="text-[12.5px] text-slate mb-4.5">
          This profile doesn&apos;t exist or is no longer a runner.
        </div>
        <Link href="/browse" className="w-full block">
          <Button variant="outline">Back to browse</Button>
        </Link>
      </PhoneFrame>
    );
  }

  if (!runner) {
    return (
      <PhoneFrame>
        <LoadingState label="Loading profile…" />
      </PhoneFrame>
    );
  }

  const waLinkValue = waLink(contactWhatsApp);

  return (
    <PhoneFrame>
      <div className="flex gap-4 items-center mb-5">
        <div
          className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex-shrink-0 flex items-center justify-center font-display font-bold text-xl md:text-2xl text-white"
          style={{ background: runner.avatarColor }}
        >
          {runner.avatarInitials}
        </div>
        <div className="min-w-0">
          <div className="text-[19px] md:text-[30px] font-bold font-display leading-tight break-words">{runner.name}</div>
          <div className="text-[12.5px] text-slate flex items-center gap-1.5 mt-0.5 flex-wrap">
            {runner.area} · <StatusPill status={runner.status} note={runner.statusNote} />
          </div>
        </div>
      </div>

      <div className="md:grid md:grid-cols-[1fr_360px] md:gap-6 md:items-start">

      {/* Main content column */}
      <div className="min-w-0">
      <div className="grid grid-cols-3 gap-2 my-4">
        <div className="bg-white border border-line rounded-[10px] p-3 text-center">
          <div className="font-mono font-semibold text-[17px] md:text-[20px]">{runner.jobsCompleted}</div>
          <div className="text-[9.5px] text-slate uppercase tracking-wide mt-0.5">Jobs done</div>
        </div>
        <div className="bg-white border border-line rounded-[10px] p-3 text-center">
          <div className="font-mono font-semibold text-[17px] md:text-[20px]">{avgRating ?? "—"}</div>
          <div className="text-[9.5px] text-slate uppercase tracking-wide mt-0.5">Rating</div>
        </div>
        <div className="bg-white border border-line rounded-[10px] p-3 text-center">
          <div className="font-mono font-semibold text-[17px] md:text-[20px]">
            {runner.acceptRate === null ? "—" : `${runner.acceptRate}%`}
          </div>
          <div className="text-[9.5px] text-slate uppercase tracking-wide mt-0.5">Accept rate</div>
        </div>
      </div>

      {runner.milestones.length > 0 && (
        <div className="flex gap-2 my-3.5 flex-wrap">
          {runner.milestones.map((m) => (
            <div
              key={m}
              className="text-[11px] bg-[#FDF6E3] border border-[#F0E0A8] text-[#8A6D00] px-2.5 py-1.5 rounded-full font-mono"
            >
              {m}
            </div>
          ))}
        </div>
      )}

      <div className="text-[11px] font-mono font-bold uppercase tracking-wide text-slate mt-4.5 mb-2">
        Services & pricing
      </div>
      {runner.services.length === 0 ? (
        <div className="text-[12px] text-slate bg-paper2 rounded-lg px-3 py-3 italic">
          This runner hasn&apos;t set up their services yet — send a request and chat on WhatsApp
          once it&apos;s accepted to arrange the details.
        </div>
      ) : (
        runner.services.map((s) => (
          <div key={s.id} className="flex justify-between items-center py-2.5 border-b border-line text-[13px] last:border-b-0 gap-2">
            <span className="min-w-0">
              {titleCase(cleanServiceName(s.name))}{" "}
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-paper2 text-ink whitespace-nowrap">
                {pricingLabel(s.pricing.model)}
              </span>
            </span>
            <span className="font-mono whitespace-nowrap flex-shrink-0">
              {s.pricing.model === "custom"
                ? s.pricing.description
                : `${formatRM(s.pricing.price)}${s.pricing.model === "per_item" ? "/item" : "/trip"}`}
            </span>
          </div>
        ))
      )}

      {reviews.length > 0 && (
        <>
          <div className="text-[11px] font-mono font-bold uppercase tracking-wide text-slate mt-4.5 mb-2">
            Recent reviews
          </div>
          <div className="grid gap-2.5 md:grid-cols-2">
          {reviews.map((r) => (
            <div key={r.id} className="bg-white border border-line rounded-[10px] p-2.5">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold">{r.authorName}</span>
                <span className="text-yellow font-semibold">{"★".repeat(r.rating)}</span>
              </div>
              <div className="text-[12.5px] text-[#4B5250]">{r.text}</div>
            </div>
          ))}
          </div>
        </>
      )}

      {reviews.length === 0 && (
        <div className="text-[12px] text-slate bg-paper2 rounded-lg px-3 py-3 italic mt-4.5">
          No reviews yet — be the first to let the neighbourhood know how this runner did.
        </div>
      )}
      </div>

      {/* Sticky action sidebar */}
      <aside className="md:sticky md:top-24">
        <div className="bg-white border border-line rounded-card p-4">
          <div className="flex flex-col gap-2">
            {waLinkValue ? (
              <a
                href={waLinkValue}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full rounded-[10px] px-4 py-3 text-[13.5px] font-semibold text-center inline-flex items-center justify-center gap-2 bg-[#25D366] text-white transition-opacity hover:opacity-90"
              >
                💬 WhatsApp
              </a>
            ) : (
              <div className="w-full rounded-[10px] px-4 py-3 text-[13.5px] text-center bg-paper2 text-slate">
                {contactLoaded
                  ? "🔒 WhatsApp unlocks after your request is accepted"
                  : "Loading contact…"}
              </div>
            )}
            <Link
              href={`/request?runner=${runner.id}`}
              className="w-full rounded-[10px] px-4 py-3 text-[13.5px] font-semibold text-center inline-flex items-center justify-center gap-2 bg-orange text-white transition-opacity hover:opacity-90"
            >
              Request service
            </Link>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowReport((s) => !s);
                  setReportMsg("");
                }}
                className="flex-1 rounded-[10px] px-3 py-2.5 text-[12px] font-semibold text-slate border border-line hover:border-orange hover:text-orange transition-colors"
              >
                🚩 Report
              </button>
              <button
                onClick={async () => {
                  if (blocked === null) return;
                  setBlocking(true);
                  const ok = blocked
                    ? await unblockUser(runner.id)
                    : await blockUser(runner.id);
                  if (ok) setBlocked(!blocked);
                  setBlocking(false);
                }}
                disabled={blocking}
                className="flex-1 rounded-[10px] px-3 py-2.5 text-[12px] font-semibold border transition-colors disabled:opacity-50"
                style={{ borderColor: blocked ? "#FDEFE3" : "var(--color-line, #E6E2D6)" }}
              >
                {blocked === null
                  ? "…"
                  : blocked
                  ? "Unblock ✅"
                  : "🚫 Block runner"}
              </button>
            </div>

            {showReport && (
              <div className="bg-[#FDF6E3] border border-[#F0E0A8] rounded-[10px] p-3">
                <div className="text-[11.5px] font-semibold mb-2">Report {runner.name.split(" ")[0]}</div>
                <select
                  className="w-full bg-white border border-line rounded-[10px] px-2.5 py-2 text-[12px] mb-2"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                >
                  <option value="">Choose a reason…</option>
                  {REPORT_REASONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
                <textarea
                  className="w-full bg-white border border-line rounded-[10px] px-2.5 py-2 text-[12px] min-h-[54px] mb-2"
                  placeholder="Anything the admin should know? (optional)"
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    className="w-auto px-3 py-1.5 text-[11px] rounded-lg"
                    disabled={reporting || !reportReason}
                    onClick={async () => {
                      setReporting(true);
                      setReportMsg("");
                      const res = await submitReport({
                        reportedId: runner.id,
                        reason: reportReason,
                        details: reportDetails,
                      });
                      setReporting(false);
                      if (res.ok) {
                        setReportMsg("Report sent. Thanks for keeping the community safe. ✓");
                        setReportReason("");
                        setReportDetails("");
                        setShowReport(false);
                      } else {
                        setReportMsg(res.message ?? "Couldn't send your report.");
                      }
                    }}
                  >
                    {reporting ? "Sending…" : "Send report"}
                  </Button>
                  {reportMsg && <span className="text-[10.5px] text-slate">{reportMsg}</span>}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-line space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-[12.5px]">
              <span className="text-slate">Area</span>
              <span className="font-semibold text-right">{runner.area}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[12.5px]">
              <span className="text-slate">Status</span>
              <StatusPill status={runner.status} note={runner.statusNote} />
            </div>
            {runner.scheduleFrom && runner.scheduleTo && (
              <div className="flex items-center justify-between gap-2 text-[12.5px]">
                <span className="text-slate">Schedule</span>
                <span className="font-semibold text-right">
                  {runner.scheduleFrom} – {runner.scheduleTo}
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>
      </div>
    </PhoneFrame>
  );
}
