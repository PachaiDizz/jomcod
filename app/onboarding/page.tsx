"use client";

import { useEffect, useState } from "react";
import PhoneFrame from "@/components/PhoneFrame";
import Button from "@/components/Button";
import TimePicker from "@/components/TimePicker";
import { createClient } from "@/lib/supabase/client";
import { upsertProfile } from "@/lib/queries";
import { AREA_OPTIONS, isValidWhatsApp, normalizeWhatsApp } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

export default function OnboardingPage() {
  const { t } = useI18n();
  const [role, setRole] = useState<"community" | "runner">("community");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [sahabat, setSahabat] = useState("");
  const [noRumah, setNoRumah] = useState("");
  const [block, setBlock] = useState("");
  const [scheduleFrom, setScheduleFrom] = useState("");
  const [scheduleTo, setScheduleTo] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        setDisplayName(
          data.user?.user_metadata?.full_name ?? data.user?.user_metadata?.name ?? ""
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleFinish = async () => {
    setSaving(true);
    setError("");

    const trimmedPhone = phone.trim();
    if (trimmedPhone && !isValidWhatsApp(trimmedPhone)) {
      setError(t("home.validWhatsApp"));
      setSaving(false);
      return;
    }
    const normalizedPhone = trimmedPhone ? normalizeWhatsApp(trimmedPhone) : "";
    let supabase;
    try {
      supabase = createClient();
      const { data: updated, error: err } = await supabase.auth.updateUser({
        data: {
          role,
          username: username || undefined,
          whatsapp: normalizedPhone,
          area,
          sahabat,
          no_rumah: noRumah,
          block,
          schedule_from: scheduleFrom,
          schedule_to: scheduleTo,
        },
      });
      if (err) {
        setError(err.message || t("onb.saveDetailsError"));
        setSaving(false);
        return;
      }

      const { error: profileErr } = await upsertProfile({
        role,
        whatsapp: normalizedPhone,
        area,
        username,
        sahabat,
        no_rumah: noRumah,
        block,
        schedule_from: scheduleFrom,
        schedule_to: scheduleTo,
      });
      if (profileErr) {
        setError(profileErr.message || t("onb.saveProfileError"));
        setSaving(false);
        return;
      }

      // Make sure the role is really on the session before navigating, so the
      // middleware never bounces us back to onboarding.
      const { data: refreshed } = await supabase.auth.refreshSession();
      const savedRole = refreshed?.user?.user_metadata?.role ?? updated.user?.user_metadata?.role;
      if (savedRole !== role) {
        setError(t("onb.roleNotSaved"));
        setSaving(false);
        return;
      }

      setSaving(false);
      // Hard navigation — guarantees the middleware sees the fresh session
      // cookie with the role (router.push can race with cookie updates in
      // Next.js App Router and bounce straight back to onboarding).
      window.location.href = "/dashboard";
    } catch (e) {
      console.error("Onboarding error:", e);
      setError(e instanceof Error ? e.message : t("onb.somethingWrong"));
      setSaving(false);
    }
  };

  return (
    <PhoneFrame narrow>
      <div className="text-[19px] md:text-[24px] font-bold mb-1 font-display">
        {displayName ? t("onb.welcome", { name: displayName.split(" ")[0] }) : t("onb.tellMore")}
      </div>
      <div className="text-[12.5px] text-slate mb-4.5">
        {t("onb.pickHow")}
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <button
          onClick={() => setRole("community")}
          className={`border-[1.5px] rounded-xl p-3.5 text-left transition-colors ${
            role === "community" ? "border-orange bg-[#FDF3EE]" : "border-line bg-white"
          }`}
        >
          <div className="text-xl mb-1.5">🏠</div>
          <div className="font-bold text-[13px] mb-1">{t("role.community")}</div>
          <div className="text-[11px] text-slate leading-snug">
            {t("home.roleCommunitySub")}
          </div>
        </button>
        <button
          onClick={() => setRole("runner")}
          className={`border-[1.5px] rounded-xl p-3.5 text-left transition-colors ${
            role === "runner" ? "border-orange bg-[#FDF3EE]" : "border-line bg-white"
          }`}
        >
          <div className="text-xl mb-1.5">🛵</div>
          <div className="font-bold text-[13px] mb-1">{t("role.runner")}</div>
          <div className="text-[11px] text-slate leading-snug">
            {t("home.roleRunnerSub")}
          </div>
        </button>
      </div>

      <div className="mb-3.5">
        <label className="text-xs font-semibold mb-1.5 block">
          {t("home.username")} <span className="text-slate font-normal">{t("onb.usernameHint")}</span>
        </label>
        <input
          className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13.5px]"
          placeholder={t("onb.enterUsername")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div className="mb-3.5">
        <label className="text-xs font-semibold mb-1.5 block">{t("home.phoneWhatsapp")}</label>
        <input
          className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13.5px]"
          placeholder={t("onb.enterPhone")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <div className="mb-3.5">
        <label className="text-xs font-semibold mb-1.5 block">{t("home.area")}</label>
        <select
          className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13.5px]"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        >
          <option value="">{t("home.selectArea")}</option>
          {AREA_OPTIONS.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </div>
      {role === "community" && (
        <>
          <div className="text-[10.5px] text-slate mb-2">
            {t("home.deliveryAddressHint")}
          </div>
          <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-2 mb-3.5">
          <div>
            <label className="text-[10.5px] font-semibold text-slate block mb-1">{t("home.sahabat")}</label>
            <input
              className="w-full bg-white border border-line rounded-[10px] px-2.5 py-2.5 text-[13px]"
              placeholder={t("onb.enterSahabat")}
              value={sahabat}
              onChange={(e) => setSahabat(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10.5px] font-semibold text-slate block mb-1">{t("home.noRumah")}</label>
            <input
              className="w-full bg-white border border-line rounded-[10px] px-2.5 py-2.5 text-[13px]"
              placeholder={t("onb.enterNoRumah")}
              value={noRumah}
              onChange={(e) => setNoRumah(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10.5px] font-semibold text-slate block mb-1">{t("home.block")}</label>
            <input
              className="w-full bg-white border border-line rounded-[10px] px-2.5 py-2.5 text-[13px]"
              placeholder={t("onb.enterBlock")}
              value={block}
              onChange={(e) => setBlock(e.target.value)}
            />
          </div>
          </div>
        </>
      )}
      {role === "runner" && (
        <div className="mb-3.5">
          <label className="text-xs font-semibold mb-1.5 block">
            {t("home.availabilitySchedule")}
          </label>
          <div className="flex gap-2">
            <TimePicker
              value={scheduleFrom}
              onChange={setScheduleFrom}
              placeholder={t("picker.fromShort")}
            />
            <TimePicker
              value={scheduleTo}
              onChange={setScheduleTo}
              placeholder={t("picker.toShort")}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="text-[12px] text-orange bg-[#FDEFE3] rounded-[10px] px-3 py-2 mb-3">
          {error}
        </div>
      )}

      <Button onClick={handleFinish} disabled={saving || loading}>
        {saving ? t("common.saving") : t("onb.finishSetup")}
      </Button>
    </PhoneFrame>
  );
}
