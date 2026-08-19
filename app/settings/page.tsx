"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import PhoneFrame from "@/components/PhoneFrame";
import Button from "@/components/Button";
import TimePicker from "@/components/TimePicker";
import RoleBadge from "@/components/RoleBadge";
import LoadingState from "@/components/LoadingState";
import { createClient } from "@/lib/supabase/client";
import { normalizeWhatsApp, isValidWhatsApp } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import {
  deleteAccount,
  fetchActiveJobs,
  getProfile,
  switchRole,
  updateProfile,
  type ProfileRow,
} from "@/lib/queries";
import { APP_VERSION } from "@/lib/version";
import type { RunnerStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: RunnerStatus; label: string; color: string }[] = [
  { value: "available", label: "Available", color: "#2E6E62" },
  { value: "busy", label: "Busy", color: "#F2B705" },
  { value: "delivery", label: "On delivery", color: "#E85D2C" },
  { value: "offline", label: "Offline", color: "#6B7280" },
];

function parseTime12(t: string): { h: number; m: number } | null {
  const m = t?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return { h, m: parseInt(m[2], 10) };
}

function ScheduleBanner({ from, to }: { from: string; to: string }) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const start = parseTime12(from);
  const end = parseTime12(to);
  let timerText = "";
  if (start && end) {
    const today = new Date(now);
    const startD = new Date(today);
    startD.setHours(start.h, start.m, 0, 0);
    const endD = new Date(today);
    endD.setHours(end.h, end.m, 0, 0);
    const pad = (ms: number) => {
      const totalMin = Math.max(0, Math.round(ms / 60000));
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };
    if (now < startD.getTime()) timerText = t("set.startsIn", { time: pad(startD.getTime() - now) });
    else if (now < endD.getTime()) timerText = t("set.left", { time: pad(endD.getTime() - now) });
    else timerText = t("set.doneToday");
  }

  return (
    <div className="bg-[#E4F3EC] border border-[#C8E6DA] rounded-[10px] px-3 py-2.5 mt-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[12px] font-semibold text-teal">
          {t("set.scheduleBanner", { from, to })}
        </span>
        {timerText && (
          <span className="font-mono text-[11px] font-bold text-teal bg-white border border-[#C8E6DA] rounded-full px-2.5 py-1">
            {timerText}
          </span>
        )}
      </div>
    </div>
  );
}

// Two-step account deletion: typed confirmation + a separate confirm button,
// so a single stray tap can never delete an account.
function DeleteAccountModal({
  onCancel,
  onConfirm,
  busy,
  error,
  confirmText,
  setConfirmText,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
  error: string;
  confirmText: string;
  setConfirmText: (v: string) => void;
}) {
  const { t } = useI18n();
  const canConfirm = confirmText === "DELETE" && !busy;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const content = (
    <>
      <div className="fixed inset-0 z-[70] bg-black/50" />
      <div className="fixed inset-0 z-[71] overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-4">
          <div className="bg-paper border border-line rounded-[20px] w-full max-w-[420px] p-5 md:p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[19px] font-bold font-display text-[#DC2626]">
                🗑 {t("set.deleteTitle")}
              </div>
              <button
                type="button"
                aria-label={t("common.cancel")}
                onClick={onCancel}
                disabled={busy}
                className="w-8 h-8 flex-shrink-0 rounded-full bg-line/50 hover:bg-line flex items-center justify-center text-[15px] text-slate hover:text-ink"
              >
                ✕
              </button>
            </div>
            <p className="text-[12.5px] leading-relaxed text-slate mt-1 mb-4">
              {t("set.deleteBody")}
            </p>
            <label className="text-[10.5px] font-semibold text-slate block mb-1">
              {t("set.deleteType")}
            </label>
            <input
              className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13px] font-mono mb-3"
              placeholder="DELETE"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
            />
            {error && (
              <div className="text-[12px] text-orange bg-[#FDEFE3] rounded-[10px] px-3 py-2 mb-2">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="!w-auto !px-4 !py-2 text-[12px]"
                onClick={onCancel}
                disabled={busy}
              >
                {t("set.deleteCancel")}
              </Button>
              <button
                type="button"
                disabled={!canConfirm}
                onClick={onConfirm}
                className="flex-1 rounded-[10px] px-4 py-3 text-[13.5px] font-semibold text-center inline-flex items-center justify-center gap-2 bg-[#DC2626] text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
              >
                {busy ? t("set.deleteBusy") : t("set.deleteConfirm")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (typeof window === "undefined") return null;
  return createPortal(content, document.body);
}

export default function SettingsPage() {
  const { t } = useI18n();
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [username, setUsername] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [area, setArea] = useState("");
  const [sahabat, setSahabat] = useState("");
  const [noRumah, setNoRumah] = useState("");
  const [block, setBlock] = useState("");
  const [status, setStatus] = useState<RunnerStatus>("offline");
  const [scheduleFrom, setScheduleFrom] = useState("");
  const [scheduleTo, setScheduleTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState("");
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [uid, setUid] = useState("");
  const [activeJobCount, setActiveJobCount] = useState(0);

  // Switch Runner → Community (inline confirm)
  const [confirmCommunity, setConfirmCommunity] = useState(false);
  const [switchSaving, setSwitchSaving] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const [switchMsg, setSwitchMsg] = useState("");

  // Delete account (danger zone)
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUid(user.id);
      setEmail(user.email ?? "");
      const md = user.user_metadata ?? {};
      setRole((md.role ?? "community") as string);

      const profile = await getProfile();
      if (profile) {
        setIsAdmin(!!profile.is_admin);
        setIsApproved(profile.is_approved ?? true);
        setUsername(profile.username ?? md.username ?? "");
        setWhatsapp(profile.whatsapp ?? md.whatsapp ?? "");
        setArea(profile.area ?? md.area ?? "");
        setSahabat(profile.sahabat ?? md.sahabat ?? "");
        setNoRumah(profile.no_rumah ?? md.no_rumah ?? "");
        setBlock(profile.block ?? md.block ?? "");
        setStatus((profile.status as RunnerStatus) ?? "offline");
        setScheduleFrom(profile.schedule_from ?? "");
        setScheduleTo(profile.schedule_to ?? "");
      } else {
        setUsername(md.username ?? "");
        setWhatsapp(md.whatsapp ?? "");
        setArea(md.area ?? "");
        setSahabat(md.sahabat ?? "");
        setNoRumah(md.no_rumah ?? "");
        setBlock(md.block ?? "");
      }

      const active = await fetchActiveJobs(user.id);
      setActiveJobCount(active.length);

      setLoaded(true);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError("");

    const trimmedWhatsApp = whatsapp.trim();
    if (trimmedWhatsApp && !isValidWhatsApp(trimmedWhatsApp)) {
      setError(t("home.validWhatsApp"));
      setSaving(false);
      return;
    }
    const normalizedWhatsApp = trimmedWhatsApp ? normalizeWhatsApp(trimmedWhatsApp) : "";
    const supabase = createClient();

    const { error: authErr } = await supabase.auth.updateUser({
      data: {
        username,
        whatsapp: normalizedWhatsApp,
        area,
        sahabat,
        no_rumah: noRumah,
        block,
        status,
        schedule_from: scheduleFrom,
        schedule_to: scheduleTo,
      },
    });
    if (authErr) {
      setError(authErr.message);
      setSaving(false);
      return;
    }

    const updates: Partial<ProfileRow> = {
      username: username || null,
      whatsapp: normalizedWhatsApp,
      area,
      sahabat: sahabat || null,
      no_rumah: noRumah || null,
      block: block || null,
      status,
      schedule_from: scheduleFrom,
      schedule_to: scheduleTo,
    };
    const ok = await updateProfile(updates);
    if (!ok) {
      setError(t("set.profileSaveFailed"));
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const saveSchedule = async () => {
    setScheduleMsg("");
    const ok = await updateProfile({
      schedule_from: scheduleFrom,
      schedule_to: scheduleTo,
    });
    if (!ok) {
      setScheduleMsg(t("set.saveFailed"));
      return;
    }
    setScheduleMsg(t("set.scheduleSaved"));
    setTimeout(() => setScheduleMsg(""), 3000);
  };

  // Switching to Runner is a direct flip. The runner fills in their services
  // and schedule on the runner dashboard, which shows a reminder until they
  // do. Approval resets to pending — same as a new signup.
  const confirmSwitchToRunner = async () => {
    setSwitchSaving(true);
    setSwitchError("");
    const active = uid ? await fetchActiveJobs(uid) : [];
    setActiveJobCount(active.length);
    if (active.length > 0) {
      setSwitchError(t("set.switchActiveJobs"));
      setSwitchSaving(false);
      return;
    }
    const res = await switchRole("runner");
    setSwitchSaving(false);
    if (!res.ok) {
      setSwitchError(res.message ?? t("set.switchError"));
      return;
    }
    // Hard navigation so middleware + nav read the fresh role cookie.
    window.location.href = "/dashboard";
  };

  const confirmSwitchToCommunity = async () => {
    setSwitchError("");
    const active = uid ? await fetchActiveJobs(uid) : [];
    setActiveJobCount(active.length);
    if (active.length > 0) {
      setSwitchError(t("set.switchActiveJobs"));
      return;
    }
    setSwitchSaving(true);
    const res = await switchRole("community");
    setSwitchSaving(false);
    if (!res.ok) {
      setSwitchError(res.message ?? t("set.switchError"));
      return;
    }
    setConfirmCommunity(false);
    setSwitchMsg(t("set.switchSuccess"));
    window.location.href = "/dashboard";
  };

  const openDelete = () => {
    setDeleteError("");
    setDeleteConfirmText("");
    if (activeJobCount > 0) {
      setDeleteError(t("set.deleteActiveJobs"));
      return;
    }
    setShowDelete(true);
  };

  const confirmDelete = async () => {
    if (deleteConfirmText !== "DELETE" || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError("");
    const res = await deleteAccount();
    if (!res.ok) {
      setDeleteBusy(false);
      if (res.message === "active-jobs") setDeleteError(t("set.deleteActiveJobs"));
      else if (res.message === "not-deployed") setDeleteError(t("set.deleteNotDeployed"));
      else setDeleteError(t("set.deleteError"));
      return;
    }
    await createClient().auth.signOut();
    window.location.href = "/?deleted=1";
  };

  if (!loaded) {
    return (
      <PhoneFrame>
        <LoadingState label={t("set.loading")} />
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <div className="mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-[22px] md:text-[30px] font-bold font-display">{t("set.title")}</div>
          <RoleBadge role={role} />
        </div>
        <div className="text-[13px] text-slate mt-0.5">
          {role === "runner" ? t("set.subRunner") : t("set.subCommunity")}
        </div>
      </div>

      <div className="md:grid md:grid-cols-2 md:gap-6 md:items-start">
        {/* Left: profile */}
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wide text-ink mb-2">
            {t("set.profile")}
          </div>
          <div className="bg-white border border-line rounded-[12px] p-3.5 mb-4">
            <div className="mb-3">
              <label className="text-[10.5px] font-semibold text-slate block mb-1">{t("set.username")}</label>
              <input
                className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13px]"
                placeholder="e.g. speedyAhmad"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <div className="text-[10.5px] text-slate mt-1">
                {t("set.usernameHint")}
              </div>
            </div>
            <div className="mb-3">
              <label className="text-[10.5px] font-semibold text-slate block mb-1">
                {t("set.whatsapp")}
              </label>
              <input
                className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13px]"
                placeholder="e.g. 012-3456789"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />
              <div className="text-[10.5px] text-slate mt-1">
                {t("set.whatsappHint")}
              </div>
            </div>
            <div className="mb-2">
              <label className="text-[10.5px] font-semibold text-slate block mb-1">
                {t("home.area")}
              </label>
              <input
                className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13px]"
                placeholder="e.g. Felda Desa Kencana"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              />
            </div>
            {role === "community" && (
              <>
                <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-2 mt-2">
                  <div>
                    <label className="text-[10.5px] font-semibold text-slate block mb-1">
                      Sahabat
                    </label>
                    <input
                      className="w-full bg-white border border-line rounded-[10px] px-2.5 py-2.5 text-[13px]"
                      placeholder="e.g. 05"
                      value={sahabat}
                      onChange={(e) => setSahabat(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-semibold text-slate block mb-1">
                      No. Rumah
                    </label>
                    <input
                      className="w-full bg-white border border-line rounded-[10px] px-2.5 py-2.5 text-[13px]"
                      placeholder="e.g. 203"
                      value={noRumah}
                      onChange={(e) => setNoRumah(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-semibold text-slate block mb-1">{t("home.block")}</label>
                    <input
                      className="w-full bg-white border border-line rounded-[10px] px-2.5 py-2.5 text-[13px]"
                      placeholder="e.g. A"
                      value={block}
                      onChange={(e) => setBlock(e.target.value)}
                    />
                  </div>
                </div>
                <div className="text-[10.5px] text-slate mt-2">
                  {t("home.deliveryAddressHint")}
                </div>
              </>
            )}
          </div>

          <div className="text-[11px] font-mono uppercase tracking-wide text-ink mb-2">
            {t("set.account")}
          </div>
          <div className="bg-white border border-line rounded-[12px] p-3.5 mb-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[13px] font-semibold">{t("home.email")}</span>
              <span className="text-[12px] text-slate font-mono">{email}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold">{t("set.role")}</span>
              <span className="text-[12px] capitalize text-slate font-mono">{role}</span>
            </div>
          </div>

          {/* Account type / role switch */}
          <div className="text-[11px] font-mono uppercase tracking-wide text-ink mb-2">
            {t("set.accountType")}
          </div>
          <div className="bg-white border border-line rounded-[12px] p-3.5 mb-4">
            <div className="text-[13px] font-semibold">
              {t("set.roleCurrent", { role: t(role === "runner" ? "role.runner" : "role.community") })}
            </div>
            <div className="text-[11px] text-slate mt-0.5">
              {role === "runner" ? t("set.switchToCommunity") : t("set.switchToRunner")}
            </div>

            {switchMsg && (
              <div className="text-[12px] text-teal font-semibold mt-2.5">{switchMsg}</div>
            )}
            {switchError && (
              <div className="text-[12px] text-orange bg-[#FDEFE3] rounded-[10px] px-3 py-2 mt-2.5">
                {switchError}
              </div>
            )}

            {role === "community" ? (
              <>
                <Button
                  variant="secondary"
                  className="!w-auto !px-4 !py-2 text-[12px] mt-3"
                  disabled={switchSaving}
                  onClick={confirmSwitchToRunner}
                >
                  {switchSaving ? t("common.saving") : `🛵 ${t("set.switchToRunnerBtn")}`}
                </Button>
                <div className="text-[10.5px] text-slate mt-2">
                  {t("set.switchPendingApproval")}
                </div>
              </>
            ) : (
              <>
                {isApproved === false && (
                  <div className="text-[11.5px] text-[#8A6D00] bg-[#FDF6E3] border border-[#F0E0A8] rounded-[10px] px-3 py-2.5 mt-2.5">
                    {t("set.runnerPendingNote")}
                  </div>
                )}
                {!confirmCommunity ? (
                  <Button
                    variant="outline"
                    className="!w-auto !px-4 !py-2 text-[12px] mt-3"
                    onClick={() => {
                      setSwitchError("");
                      setConfirmCommunity(true);
                    }}
                  >
                    🏠 {t("set.switchToCommunityBtn")}
                  </Button>
                ) : (
                  <div className="mt-3 border border-orange/30 bg-[#FDEFE3] rounded-[10px] p-3">
                    <div className="text-[12px] text-orange font-semibold mb-1">
                      {t("set.switchCommunityTitle")}
                    </div>
                    <div className="text-[11.5px] text-slate leading-snug mb-2.5">
                      {t("set.switchCommunityBody")}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        className="!w-auto !px-3.5 !py-2 text-[11.5px] rounded-lg"
                        disabled={switchSaving}
                        onClick={confirmSwitchToCommunity}
                      >
                        {switchSaving ? t("common.saving") : t("set.confirmCommunity")}
                      </Button>
                      <Button
                        variant="outline"
                        className="!w-auto !px-3.5 !py-2 text-[11.5px] rounded-lg"
                        disabled={switchSaving}
                        onClick={() => setConfirmCommunity(false)}
                      >
                        {t("set.cancelSwitch")}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center justify-between gap-2 bg-white border border-orange/30 rounded-[12px] p-3.5 mb-4 hover:border-orange/60 transition-colors"
            >
              <div>
                <div className="text-[13px] font-semibold text-orange">🛠 {t("nav.admin")}</div>
                <div className="text-[11px] text-slate mt-0.5">{t("set.adminHint")}</div>
              </div>
              <span className="text-slate">→</span>
            </Link>
          )}

          <button
            onClick={() => window.dispatchEvent(new CustomEvent("jomcod:show-update"))}
            className="w-full flex items-center justify-between gap-2 bg-white border border-line rounded-[12px] p-3.5 mb-4 text-left hover:border-teal/50 transition-colors"
          >
            <div>
              <div className="text-[13px] font-semibold text-teal">🆕 {t("set.whatsNew")}</div>
              <div className="text-[11px] text-slate mt-0.5">
                {t("set.whatsNewHint", { version: APP_VERSION })}
              </div>
            </div>
            <span className="text-slate">→</span>
          </button>

          {error && (
            <div className="text-[12px] text-orange bg-[#FDEFE3] rounded-[10px] px-3 py-2 mb-3">
              {error}
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={saving}
            className="!w-auto !px-4 !py-2 text-[12px]"
          >
            {saving ? t("common.saving") : t("set.saveChanges")}
          </Button>
          {saved && (
            <div className="text-[12.5px] text-teal font-semibold mt-2">
              {t("common.saved")}
            </div>
          )}
        </div>

        {/* Right: availability (runners only) */}
        <div>
          {role === "runner" && (
            <>
              <div className="text-[11px] font-mono uppercase tracking-wide text-ink mb-2">
                {t("set.availability")}
              </div>
              <div className="bg-white border border-line rounded-[12px] p-3.5 mb-4">
                <div className="text-[10.5px] font-semibold text-slate block mb-2">{t("set.yourStatus")}</div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setStatus(opt.value)}
                      className={`border-[1.5px] rounded-[10px] px-2.5 py-2.5 text-left text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        status === opt.value ? "border-teal bg-[#F0F8F5]" : "border-line bg-white"
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: opt.color }}
                      />
                      {t(`status.${opt.value}`)}
                    </button>
                  ))}
                </div>
                <div className="text-[10.5px] font-semibold text-slate block mb-1">
                  {t("set.schedule")}
                </div>
                <div className="flex flex-wrap gap-2 mb-2 min-w-0">
                  <TimePicker
                    value={scheduleFrom}
                    onChange={setScheduleFrom}
                    placeholder={t("picker.from")}
                  />
                  <TimePicker
                    value={scheduleTo}
                    onChange={setScheduleTo}
                    placeholder={t("picker.to")}
                  />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Button
                    className="!w-auto !px-3.5 !py-2 text-[11.5px] rounded-lg !bg-teal !text-white shadow-[0_6px_16px_-6px_rgba(46,110,98,0.5)]"
                    onClick={saveSchedule}
                  >
                    {t("set.saveSchedule")}
                  </Button>
                  {scheduleMsg && (
                    <span
                      className={`text-[11px] font-semibold ${
                        scheduleMsg.includes("✓") ? "text-teal" : "text-orange"
                      }`}
                    >
                      {scheduleMsg}
                    </span>
                  )}
                </div>
                <div className="text-[10.5px] text-slate">
                  {t("set.scheduleHint")}
                </div>
                {scheduleFrom && scheduleTo && (
                  <ScheduleBanner from={scheduleFrom} to={scheduleTo} />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Danger zone */}
      <div className="mt-8">
        <div className="text-[11px] font-mono uppercase tracking-wide text-[#DC2626]/80 mb-2">
          {t("set.danger")}
        </div>
        <div className="bg-white border border-[#DC2626]/25 rounded-[12px] p-3.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-[#DC2626]">
                🗑 {t("set.deleteAccount")}
              </div>
              <div className="text-[11px] text-slate mt-0.5">
                {t("set.deleteAccountHint")}
              </div>
            </div>
            <button
              type="button"
              onClick={openDelete}
              className="rounded-[10px] px-4 py-2.5 text-[12px] font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] transition-colors"
            >
              {t("set.deleteAccount")}
            </button>
          </div>
        </div>
      </div>

      {showDelete && (
        <DeleteAccountModal
          onCancel={() => setShowDelete(false)}
          onConfirm={confirmDelete}
          busy={deleteBusy}
          error={deleteError}
          confirmText={deleteConfirmText}
          setConfirmText={setDeleteConfirmText}
        />
      )}
    </PhoneFrame>
  );
}
