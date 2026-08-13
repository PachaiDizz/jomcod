"use client";

import { useEffect, useState } from "react";
import PhoneFrame from "@/components/PhoneFrame";
import Button from "@/components/Button";
import TimePicker from "@/components/TimePicker";
import RoleBadge from "@/components/RoleBadge";
import LoadingState from "@/components/LoadingState";
import { createClient } from "@/lib/supabase/client";
import { normalizeWhatsApp, isValidWhatsApp } from "@/lib/constants";
import {
  getProfile,
  updateProfile,
  type ProfileRow,
} from "@/lib/queries";
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
    if (now < startD.getTime()) timerText = `⏱ Starts in ${pad(startD.getTime() - now)}`;
    else if (now < endD.getTime()) timerText = `⏱ ${pad(endD.getTime() - now)} left`;
    else timerText = "✅ Done for today";
  }

  return (
    <div className="bg-[#E4F3EC] border border-[#C8E6DA] rounded-[10px] px-3 py-2.5 mt-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[12px] font-semibold text-teal">
          🕐 Your schedule: {from} – {to}
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

export default function SettingsPage() {
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

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? "");
      const md = user.user_metadata ?? {};
      setRole((md.role ?? "community") as string);

      const profile = await getProfile();
      if (profile) {
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
      setLoaded(true);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError("");

    const trimmedWhatsApp = whatsapp.trim();
    if (trimmedWhatsApp && !isValidWhatsApp(trimmedWhatsApp)) {
      setError("Enter a valid Malaysian WhatsApp number, e.g. 012-3456789.");
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
      setError("Couldn't save your profile. Please try again.");
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
      setScheduleMsg("Couldn't save — please try again.");
      return;
    }
    setScheduleMsg("Schedule saved ✓");
    setTimeout(() => setScheduleMsg(""), 3000);
  };

  if (!loaded) {
    return (
      <PhoneFrame>
        <LoadingState label="Loading settings…" />
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <div className="mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-[22px] md:text-[30px] font-bold font-display">Settings</div>
          <RoleBadge role={role} />
        </div>
        <div className="text-[13px] text-slate mt-0.5">
          {role === "runner" ? "Your profile, contact, and availability." : "Your profile and contact."}
        </div>
      </div>

      <div className="md:grid md:grid-cols-2 md:gap-6 md:items-start">
        {/* Left: profile */}
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wide text-slate mb-2">
            Profile
          </div>
          <div className="bg-white border border-line rounded-[12px] p-3.5 mb-4">
            <div className="mb-3">
              <label className="text-[10.5px] font-semibold text-slate block mb-1">Username</label>
              <input
                className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13px]"
                placeholder="e.g. speedyAhmad"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <div className="text-[10.5px] text-slate mt-1">
                This is the name runners see when you request their service.
              </div>
            </div>
            <div className="mb-3">
              <label className="text-[10.5px] font-semibold text-slate block mb-1">
                WhatsApp Number
              </label>
              <input
                className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13px]"
                placeholder="e.g. 012-3456789"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />
              <div className="text-[10.5px] text-slate mt-1">
                Runners use this to chat with you on WhatsApp.
              </div>
            </div>
            <div className="mb-2">
              <label className="text-[10.5px] font-semibold text-slate block mb-1">
                Area / Neighbourhood
              </label>
              <input
                className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13px]"
                placeholder="e.g. Felda Desa Kencana"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
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
                <label className="text-[10.5px] font-semibold text-slate block mb-1">Block</label>
                <input
                  className="w-full bg-white border border-line rounded-[10px] px-2.5 py-2.5 text-[13px]"
                  placeholder="e.g. A"
                  value={block}
                  onChange={(e) => setBlock(e.target.value)}
                />
              </div>
            </div>
            <div className="text-[10.5px] text-slate mt-2">
              Your delivery address — runners use this to find you. It&apos;s also prefilled when
              you request a service.
            </div>
          </div>

          <div className="text-[11px] font-mono uppercase tracking-wide text-slate mb-2">
            Account
          </div>
          <div className="bg-white border border-line rounded-[12px] p-3.5 mb-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[13px] font-semibold">Email</span>
              <span className="text-[12px] text-slate font-mono">{email}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold">Role</span>
              <span className="text-[12px] capitalize text-slate font-mono">{role}</span>
            </div>
          </div>

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
            {saving ? "Saving…" : "Save changes"}
          </Button>
          {saved && (
            <div className="text-[12.5px] text-teal font-semibold mt-2">
              Saved ✓
            </div>
          )}
        </div>

        {/* Right: availability (runners only) */}
        <div>
          {role === "runner" && (
            <>
              <div className="text-[11px] font-mono uppercase tracking-wide text-slate mb-2">
                Availability (runners)
              </div>
              <div className="bg-white border border-line rounded-[12px] p-3.5 mb-4">
                <div className="text-[10.5px] font-semibold text-slate block mb-2">Your status</div>
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
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="text-[10.5px] font-semibold text-slate block mb-1">
                  Schedule (optional)
                </div>
                <div className="flex gap-2 mb-2">
                  <TimePicker
                    value={scheduleFrom}
                    onChange={setScheduleFrom}
                    placeholder="From e.g. 8:00 AM"
                  />
                  <TimePicker
                    value={scheduleTo}
                    onChange={setScheduleTo}
                    placeholder="To e.g. 5:00 PM"
                  />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Button
                    className="!w-auto !px-3.5 !py-2 text-[11.5px] rounded-lg !bg-teal !text-white shadow-[0_6px_16px_-6px_rgba(46,110,98,0.5)]"
                    onClick={saveSchedule}
                  >
                    🕐 Save schedule
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
                  Set the clock when you usually run errands (or type it, e.g. 8:00 AM).
                </div>
                {scheduleFrom && scheduleTo && (
                  <ScheduleBanner from={scheduleFrom} to={scheduleTo} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}
