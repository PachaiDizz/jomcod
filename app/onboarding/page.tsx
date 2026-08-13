"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PhoneFrame from "@/components/PhoneFrame";
import Button from "@/components/Button";
import TimePicker from "@/components/TimePicker";
import { createClient } from "@/lib/supabase/client";
import { upsertProfile } from "@/lib/queries";
import { AREA_OPTIONS, isValidWhatsApp, normalizeWhatsApp } from "@/lib/constants";

export default function OnboardingPage() {
  const router = useRouter();
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
      setError("Enter a valid Malaysian WhatsApp number, e.g. 012-3456789.");
      setSaving(false);
      return;
    }
    const normalizedPhone = trimmedPhone ? normalizeWhatsApp(trimmedPhone) : "";
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({
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
    if (!err) {
      await upsertProfile({
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
    }
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push("/dashboard");
  };

  return (
    <PhoneFrame narrow>
      <div className="text-[19px] md:text-[24px] font-bold mb-1 font-display">
        {displayName ? `Welcome, ${displayName.split(" ")[0]}` : "Tell us a bit more"}
      </div>
      <div className="text-[12.5px] text-slate mb-4.5">
        Pick how you&apos;ll use JomCOD — you can be both later.
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <button
          onClick={() => setRole("community")}
          className={`border-[1.5px] rounded-xl p-3.5 text-left transition-colors ${
            role === "community" ? "border-orange bg-[#FDF3EE]" : "border-line bg-white"
          }`}
        >
          <div className="text-xl mb-1.5">🏠</div>
          <div className="font-bold text-[13px] mb-1">Community</div>
          <div className="text-[11px] text-slate leading-snug">
            Request errands & parcel pickups nearby
          </div>
        </button>
        <button
          onClick={() => setRole("runner")}
          className={`border-[1.5px] rounded-xl p-3.5 text-left transition-colors ${
            role === "runner" ? "border-orange bg-[#FDF3EE]" : "border-line bg-white"
          }`}
        >
          <div className="text-xl mb-1.5">🛵</div>
          <div className="font-bold text-[13px] mb-1">Runner</div>
          <div className="text-[11px] text-slate leading-snug">
            Offer your service, set your price
          </div>
        </button>
      </div>

      <div className="mb-3.5">
        <label className="text-xs font-semibold mb-1.5 block">
          Username <span className="text-slate font-normal">(shown to runners when you request)</span>
        </label>
        <input
          className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13.5px]"
          placeholder="Enter username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div className="mb-3.5">
        <label className="text-xs font-semibold mb-1.5 block">Phone / WhatsApp Number</label>
        <input
          className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13.5px]"
          placeholder="Enter phone / WhatsApp number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <div className="mb-3.5">
        <label className="text-xs font-semibold mb-1.5 block">Area / Neighbourhood</label>
        <select
          className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13.5px]"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        >
          <option value="">Select your area…</option>
          {AREA_OPTIONS.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </div>
      {role === "community" && (
        <>
          <div className="text-[10.5px] text-slate mb-2">
            Your delivery address (optional) — prefilled when you request a service.
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3.5">
          <div>
            <label className="text-[10.5px] font-semibold text-slate block mb-1">Sahabat</label>
            <input
              className="w-full bg-white border border-line rounded-[10px] px-2.5 py-2.5 text-[13px]"
              placeholder="Enter sahabat"
              value={sahabat}
              onChange={(e) => setSahabat(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10.5px] font-semibold text-slate block mb-1">No. Rumah</label>
            <input
              className="w-full bg-white border border-line rounded-[10px] px-2.5 py-2.5 text-[13px]"
              placeholder="Enter no. rumah"
              value={noRumah}
              onChange={(e) => setNoRumah(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10.5px] font-semibold text-slate block mb-1">Block</label>
            <input
              className="w-full bg-white border border-line rounded-[10px] px-2.5 py-2.5 text-[13px]"
              placeholder="Enter block"
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
            Availability schedule (optional)
          </label>
          <div className="flex gap-2">
            <TimePicker
              value={scheduleFrom}
              onChange={setScheduleFrom}
              placeholder="From"
            />
            <TimePicker
              value={scheduleTo}
              onChange={setScheduleTo}
              placeholder="To"
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
        {saving ? "Saving…" : "Finish setup"}
      </Button>
    </PhoneFrame>
  );
}
