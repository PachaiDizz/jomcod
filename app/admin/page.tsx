"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PhoneFrame from "@/components/PhoneFrame";
import Button from "@/components/Button";
import LoadingState from "@/components/LoadingState";
import { createClient } from "@/lib/supabase/client";
import {
  adminListJobs,
  adminListReports,
  adminListRunners,
  adminSetApproved,
  adminSetReportStatus,
  adminSetSuspended,
  getProfile,
} from "@/lib/queries";
import type { AdminJobRow, AdminRunnerRow, ReportRow } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { translateServiceName } from "@/lib/constants";

type Tab = "runners" | "jobs" | "reports";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-[#FDF6E3] text-[#8A6D00]",
  confirmed: "bg-[#F0F8F5] text-teal",
  done: "bg-[#E4F3EC] text-teal",
  expired: "bg-[#F5E4E0] text-orange",
  cancelled: "bg-[#EEEEEE] text-slate",
};

export default function AdminPage() {
  const { t } = useI18n();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [uid, setUid] = useState("");
  const [tab, setTab] = useState<Tab>("runners");
  const [runners, setRunners] = useState<AdminRunnerRow[]>([]);
  const [jobs, setJobs] = useState<AdminJobRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await createClient().auth.getUser();
      setUid(user?.id ?? "");
      const profile = await getProfile();
      setIsAdmin(!!profile?.is_admin);
    })();
  }, []);

  const load = useCallback(async () => {
    try {
      const [r, j, rep] = await Promise.all([
        adminListRunners(),
        adminListJobs(),
        adminListReports(),
      ]);
      setRunners(r);
      setJobs(j);
      setReports(rep);
    } catch (e) {
      // Not an admin — access handled by isAdmin gate.
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const toggleApproved = async (runner: AdminRunnerRow) => {
    setBusy(runner.id);
    await adminSetApproved(runner.id, !runner.isApproved);
    await load();
    setBusy("");
  };

  const toggleSuspended = async (runner: AdminRunnerRow) => {
    setBusy(runner.id);
    await adminSetSuspended(runner.id, !runner.isSuspended);
    await load();
    setBusy("");
  };

  const setReportStatus = async (reportId: string, status: string) => {
    await adminSetReportStatus(reportId, status);
    await load();
  };

  if (isAdmin === null) {
    return (
      <PhoneFrame wide>
        <LoadingState label={t("admin.checkingAccess")} />
      </PhoneFrame>
    );
  }

  if (!isAdmin) {
    return (
      <PhoneFrame>
        <div className="text-[19px] font-bold mb-1 font-display">{t("admin.only")}</div>
        <div className="text-[12.5px] text-slate mb-4.5">
          {t("admin.onlyBody")}
        </div>
        <pre className="bg-ink text-paper rounded-card p-3.5 text-[11.5px] overflow-x-auto mb-3.5 font-mono">
          {`update public.profiles\nset is_admin = true\nwhere id = '${uid || "<your-user-id>"}';`}
        </pre>
        <div className="text-[11.5px] text-slate bg-paper2 rounded-lg px-3 py-2.5 italic">
          {t("admin.yourUserId")} <span className="font-mono">{uid || t("admin.loading")}</span>
        </div>
      </PhoneFrame>
    );
  }

  const pendingApproval = runners.filter((r) => !r.isApproved).length;
  const activeJobs = jobs.filter((j) => j.status === "pending" || j.status === "confirmed").length;
  const openReports = reports.filter((r) => r.status === "open").length;

  return (
    <PhoneFrame wide>
      <div className="text-[19px] font-bold mb-1 font-display">{t("admin.title")}</div>
      <div className="text-[12.5px] text-slate mb-5">{t("admin.sub")}</div>

      <div className="grid grid-cols-4 gap-2.5 mb-5">
        <div className="bg-white border border-line rounded-[10px] p-3.5 text-center">
          <div className="font-mono font-bold text-xl">{runners.length}</div>
          <div className="text-[10px] text-slate mt-0.5 uppercase tracking-wide">{t("admin.runners")}</div>
        </div>
        <div className="bg-white border border-line rounded-[10px] p-3.5 text-center">
          <div className="font-mono font-bold text-xl text-orange">{pendingApproval}</div>
          <div className="text-[10px] text-slate mt-0.5 uppercase tracking-wide">{t("admin.pendingApproval")}</div>
        </div>
        <div className="bg-white border border-line rounded-[10px] p-3.5 text-center">
          <div className="font-mono font-bold text-xl text-teal">{activeJobs}</div>
          <div className="text-[10px] text-slate mt-0.5 uppercase tracking-wide">{t("admin.activeJobs")}</div>
        </div>
        <div className="bg-white border border-line rounded-[10px] p-3.5 text-center">
          <div className="font-mono font-bold text-xl text-orange">{openReports}</div>
          <div className="text-[10px] text-slate mt-0.5 uppercase tracking-wide">{t("admin.openReports")}</div>
        </div>
      </div>

      <div className="flex bg-paper2 rounded-[10px] p-[3px] mb-5 w-fit">
        {(["runners", "jobs", "reports"] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg capitalize transition-colors ${
              tab === tabKey ? "bg-white text-ink shadow-sm" : "text-slate hover:text-ink"
            }`}
          >
            {t(`admin.tab${tabKey[0].toUpperCase()}${tabKey.slice(1)}`)}
          </button>
        ))}
      </div>

      {tab === "runners" && (
        <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
          {runners.length === 0 ? (
            <div className="col-span-full text-center bg-white border border-dashed border-line rounded-card px-5 py-10">
              {t("admin.noRunners")}
            </div>
          ) : (
            runners.map((r) => (
              <div key={r.id} className="bg-white border border-line rounded-[10px] p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-[13.5px] break-words">{r.name}</div>
                    <div className="text-[11px] text-slate mt-0.5">
                      {r.area || t("admin.noArea")} · {r.status ?? "offline"}
                    </div>
                    <div className="text-[10px] font-mono text-slate mt-1">
                      {t("admin.joined")} {new Date(r.createdAt).toLocaleDateString("en-MY", { day: "numeric", month: "short" })}
                    </div>
                    {r.whatsapp && (
                      <div className="text-[11px] font-mono text-teal mt-1 break-words">
                        💬 {r.whatsapp}
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[9.5px] font-mono px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${
                      r.isApproved
                        ? "bg-[#E4F3EC] text-teal"
                        : r.isSuspended
                        ? "bg-[#FDEFE3] text-orange"
                        : "bg-[#FDF6E3] text-[#8A6D00]"
                    }`}
                  >
                    {r.isSuspended ? t("admin.suspended") : r.isApproved ? t("admin.approved") : t("admin.pending")}
                  </span>
                </div>
                {Array.isArray(r.services) && r.services.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[9.5px] font-mono uppercase tracking-wide text-slate mb-1">{t("admin.services")}</div>
                    <div className="flex flex-wrap gap-1">
                    {(r.services as { name?: string; pricing?: { price?: number; model?: string } }[])
                      .filter((s) => s && typeof s === "object" && s.name)
                      .map((s, i) => (
                        <span
                          key={i}
                          className="text-[9.5px] bg-[#F0F7F4] text-teal border border-[#D7EBE1] px-1.5 py-0.5 rounded"
                        >
                          {translateServiceName(t, String(s.name))}
                          {typeof s.pricing?.price === "number" ? ` · RM${s.pricing.price}` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <Button
                    variant={r.isApproved ? "outline" : "primary"}
                    className="flex-1 px-3 py-1.5 text-[11px] rounded-lg"
                    disabled={busy === r.id}
                    onClick={() => toggleApproved(r)}
                  >
                    {r.isApproved ? t("admin.unapprove") : t("admin.approve")}
                  </Button>
                  <Button
                    variant={r.isSuspended ? "secondary" : "outline"}
                    className="flex-1 px-3 py-1.5 text-[11px] rounded-lg"
                    disabled={busy === r.id}
                    onClick={() => toggleSuspended(r)}
                  >
                    {r.isSuspended ? t("admin.reinstate") : t("admin.suspend")}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "jobs" && (
        <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
          {jobs.length === 0 ? (
            <div className="col-span-full text-center bg-white border border-dashed border-line rounded-card px-5 py-10">
              {t("admin.noJobs")}
            </div>
          ) : (
            jobs.map((j) => (
              <div key={j.id} className="bg-white border border-line rounded-[10px] p-3.5">
                <div className="flex justify-between items-start gap-2">
                  <div className="text-[13px] font-semibold break-words min-w-0">{translateServiceName(t, j.serviceType)}</div>
                  <span className={`text-[9.5px] font-mono px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${STATUS_STYLES[j.status]}`}>
                    {j.status}
                  </span>
                </div>
                <div className="text-[11.5px] text-slate mt-1 leading-snug break-words">
                  {j.takeFrom} → {j.deliverTo}
                </div>
                <div className="text-[11px] text-slate mt-1.5">
                  <span className="font-semibold text-ink">{j.requesterName}</span> →{" "}
                  <span className="font-semibold text-ink">{j.runnerName ?? "—"}</span>
                </div>
                {j.total && (
                  <div className="inline-block font-mono font-bold text-[12.5px] text-teal bg-[#E4F3EC] border border-[#C8E6DA] px-2 py-0.5 rounded mt-1.5">
                    {j.total}
                  </div>
                )}
                <div className="text-[10px] font-mono text-slate mt-1.5">
                  {new Date(j.createdAt).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "reports" && (
        <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
          {reports.length === 0 ? (
            <div className="col-span-full text-center bg-white border border-dashed border-line rounded-card px-5 py-10">
              {t("admin.noReports")}
            </div>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="bg-white border border-line rounded-[10px] p-3.5">
                <div className="flex justify-between items-start gap-2">
                  <div className="font-bold text-[13px]">
                    <Link href={`/runner/${r.reportedId}`} className="hover:text-teal transition-colors">
                      {r.reportedName}
                    </Link>
                    <span className="text-slate font-normal"> — {r.reason}</span>
                  </div>
                  <span
                    className={`text-[9.5px] font-mono px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${
                      r.status === "open"
                        ? "bg-[#FDEFE3] text-orange"
                        : r.status === "resolved"
                        ? "bg-[#E4F3EC] text-teal"
                        : "bg-[#EEEEEE] text-slate"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                {r.details && <div className="text-[12px] text-[#4B5250] mt-1.5 break-words">{r.details}</div>}
                <div className="text-[10.5px] font-mono text-slate mt-1.5">
                  {t("admin.reportedBy")} {r.reporterName} · {new Date(r.createdAt).toLocaleDateString("en-MY", { day: "numeric", month: "short" })}
                </div>
                {r.status === "open" && (
                  <div className="flex gap-2 mt-3">
                    <Button variant="secondary" className="flex-1 px-3 py-1.5 text-[11px] rounded-lg" onClick={() => setReportStatus(r.id, "resolved")}>
                      {t("admin.resolve")}
                    </Button>
                    <Button variant="outline" className="flex-1 px-3 py-1.5 text-[11px] rounded-lg" onClick={() => setReportStatus(r.id, "dismissed")}>
                      {t("admin.dismiss")}
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </PhoneFrame>
  );
}
