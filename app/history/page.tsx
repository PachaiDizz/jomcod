"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PhoneFrame from "@/components/PhoneFrame";
import RoleBadge from "@/components/RoleBadge";
import { parseDeliverTo } from "@/components/RequestFields";
import { formatRM, titleCase } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { fetchJobsForRequester, fetchJobsForRunner, jobFromRow } from "@/lib/queries";
import type { JobRequest } from "@/lib/types";

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

function parseHistoryNotes(notes: string): {
  items: { name: string; qty: string; price: string }[];
  total: string | null;
} {
  const items: { name: string; qty: string; price: string }[] = [];
  let total: string | null = null;
  for (const line of notes.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const tm = t.match(/^Total:\s*(.*)$/i);
    if (tm) {
      total = tm[1]!.trim();
      continue;
    }
    const im = t.match(/^Items:\s*(.*)$/i);
    if (im) {
      for (const part of im[1]!.split(",")) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const pm = trimmed.match(/^(.*?)\s*[×x*]\s*([\d.]+)\s*(?:@\s*(RM[\d.]+))?/i);
        if (pm) {
          items.push({ name: pm[1]!.trim(), qty: pm[2]!.trim(), price: pm[3]?.trim() ?? "" });
        } else {
          items.push({ name: trimmed, qty: "", price: "" });
        }
      }
    }
  }
  return { items, total };
}

export default function HistoryPage() {
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [jobs, setJobs] = useState<JobRequest[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [tab, setTab] = useState<"all" | "done" | "cancelled" | "expired">("all");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const md = user.user_metadata ?? {};
      setName(md.username ?? md.full_name ?? md.name ?? "");
      const userRole = (md.role ?? "community") as string;
      setRole(userRole);
      const list =
        userRole === "runner"
          ? await fetchJobsForRunner(user.id)
          : await fetchJobsForRequester(user.id);
      setJobs(list);
      setLoaded(true);
    })();
  }, []);

  const past = jobs.filter((j) => j.status === "done" || j.status === "expired" || j.status === "cancelled");
  const finished = past.filter((j) => j.status === "done");

  const filtered = past.filter((j) => {
    if (tab !== "all" && j.status !== tab) return false;
    const t = j.createdAt;
    if (fromDate && t < new Date(`${fromDate}T00:00:00`).getTime()) return false;
    if (toDate && t > new Date(`${toDate}T23:59:59`).getTime()) return false;
    return true;
  });

  const hasFilter = fromDate || toDate;

  return (
    <PhoneFrame>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <div className="text-[19px] md:text-[26px] font-bold font-display">History</div>
        <RoleBadge role={role} />
      </div>
      <div className="text-[12.5px] text-slate mb-4.5">
        {name || (role === "runner" ? "Runner" : "Community member")} · {finished.length} job
        {finished.length === 1 ? "" : "s"} completed
      </div>

      {!loaded ? (
        <div className="text-center py-10 text-[12.5px] text-slate">Loading…</div>
      ) : past.length === 0 ? (
        <div className="text-center bg-white border border-dashed border-line rounded-card px-5 py-10">
          <div className="text-2xl mb-2.5">🗂️</div>
          <div className="font-display font-bold text-[16px] mb-1">No history yet</div>
          <div className="text-[12px] text-slate leading-relaxed mb-4">
            Completed and expired jobs will show up here so you can look back at what happened.
          </div>
          <Link href={role === "runner" ? "/dashboard" : "/browse"} className="w-full block">
            <button className="w-full bg-orange text-white rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold">
              {role === "runner" ? "Go to dashboard" : "Find a runner"}
            </button>
          </Link>
        </div>
      ) : (
        <>
        <div className="flex bg-paper2 rounded-[10px] p-[3px] mb-4 w-fit">
          {(
            [
              { value: "all", label: "All" },
              { value: "done", label: "Completed" },
              { value: "cancelled", label: "Cancelled" },
              { value: "expired", label: "Expired" },
            ] as const
          ).map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
                tab === t.value ? "bg-white text-ink shadow-sm" : "text-slate hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2 mb-4">
          <div>
            <label className="text-[10.5px] font-semibold text-slate block mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-white border border-line rounded-[10px] px-3 py-2 text-[12.5px]"
            />
          </div>
          <div>
            <label className="text-[10.5px] font-semibold text-slate block mb-1">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-white border border-line rounded-[10px] px-3 py-2 text-[12.5px]"
            />
          </div>
          {hasFilter && (
            <button
              onClick={() => {
                setFromDate("");
                setToDate("");
              }}
              className="text-[11.5px] font-semibold text-orange hover:underline py-2"
            >
              Clear filter
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center bg-white border border-dashed border-line rounded-card px-5 py-10">
            <div className="text-2xl mb-2">🔍</div>
            <div className="font-display font-bold text-[16px] mb-1">Nothing in this date range</div>
            <div className="text-[12px] text-slate leading-relaxed">
              Try a wider date range or clear the filter.
            </div>
          </div>
        ) : (
        <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((job) => (
          <div key={job.id} className="bg-white border border-line rounded-card overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className={`px-3.5 py-2.5 flex items-center justify-between gap-2 border-b ${JOB_BANDS[job.status]}`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[17px] leading-none flex-shrink-0">
                  {serviceEmoji(job.serviceType)}
                </span>
                <Link href={`/job/${job.id}`} className="text-[13.5px] font-bold font-display text-ink break-words hover:text-teal transition-colors">
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
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal flex-shrink-0" />
              <span className="text-[12px] font-semibold text-ink truncate flex-1">{job.takeFrom}</span>
              <span className="text-teal font-bold flex-shrink-0">→</span>
              <span className="text-[12px] font-semibold text-ink truncate flex-1 text-right">{job.deliverTo}</span>
              <span className="w-2 h-2 rounded-full bg-orange flex-shrink-0" />
            </div>
            <div className="text-[10.5px] font-mono text-slate mt-2">
              {new Date(job.createdAt).toLocaleDateString("en-MY", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            {parseHistoryNotes(job.notes ?? "").items.length > 0 && (
              <div className="rounded-[10px] bg-[#F0F7F4] border border-[#D7EBE1] px-3 py-2 mt-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-teal mb-1.5">
                  Items ordered
                </div>
                <div className="space-y-1">
                  {parseHistoryNotes(job.notes ?? "").items.map((it, i) => (
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
            {parseHistoryNotes(job.notes ?? "").total && (
              <div className="flex items-center justify-between rounded-[10px] bg-[#E4F3EC] border border-[#C8E6DA] px-3 py-2 mt-2">
                <span className="text-[11.5px] font-semibold text-teal">
                  {role === "runner" ? "Community pays" : "You paid the runner"}
                </span>
                <span className="font-mono font-bold text-[14px] text-teal">
                  {parseHistoryNotes(job.notes ?? "").total}
                </span>
              </div>
            )}
            {role === "community" && job.status === "done" && job.runnerId && (
              <Link
                href={(() => {
                  const parsed = parseDeliverTo(job.deliverTo);
                  const q = new URLSearchParams({
                    runner: job.runnerId as string,
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
                })()}
                className="mt-2.5 w-full rounded-[10px] px-4 py-2 text-[12px] font-semibold text-center inline-flex items-center justify-center gap-2 bg-orange/10 text-orange border border-orange/30 hover:bg-orange hover:text-white transition-colors"
              >
                🔄 Request again
              </Link>
            )}
            </div>
          </div>
        ))}
        </div>
        )}
        </>
      )}
    </PhoneFrame>
  );
}
