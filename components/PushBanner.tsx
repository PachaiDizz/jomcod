"use client";

import { useEffect, useState } from "react";
import { isPushEnabled, pushSupported, subscribeToPush, unsubscribeFromPush } from "@/lib/push";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";

const DISMISS_KEY = "jomcod_push_dismissed";

// Small banner asking the user to turn on real notifications so they never
// miss a request even when the app is closed. Dismissing remembers via
// localStorage (never auto-reappears unless they change devices/browsers).
export default function PushBanner() {
  const { t } = useI18n();
  const [state, setState] = useState<"hidden" | "shown" | "enabled">("hidden");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!pushSupported()) return;
        if (localStorage.getItem(DISMISS_KEY)) return;
        const {
          data: { user },
        } = await createClient().auth.getUser();
        if (!user) return;
        const enabled = await isPushEnabled();
        if (cancelled) return;
        setState(enabled ? "enabled" : "shown");
      } catch {
        // not signed in yet or error — stay hidden
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "hidden") return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setState("hidden");
  };

  const enable = async () => {
    setBusy(true);
    setError("");
    const res = await subscribeToPush();
    setBusy(false);
    if (res.ok) {
      setState("enabled");
    } else {
      setError(res.message ?? "Couldn't enable notifications.");
    }
  };

  if (state === "enabled") {
    return (
      <button
        onClick={async () => {
          await unsubscribeFromPush();
          setState("shown");
        }}
        className="fixed bottom-4 right-4 sm:right-auto sm:left-4 font-mono text-[11.5px] font-semibold bg-paper text-slate border border-line rounded-full px-4 py-2 shadow-lg z-50"
      >
        {t("push.on")}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-4 sm:right-auto sm:w-[340px] bg-ink text-paper rounded-[14px] px-4 py-3 shadow-xl z-50">
      <div className="flex items-start gap-3">
        <span className="text-[18px] flex-shrink-0">🔔</span>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-bold text-paper">
            {t("push.getNotified")}
          </div>
          <div className="text-[11px] text-[#C7CBC7] leading-snug mt-0.5">
            {t("push.desc")}
          </div>
          {error && (
            <div className="text-[11px] text-orange leading-snug mt-1.5">{error}</div>
          )}
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={enable}
              disabled={busy}
              className="text-[11.5px] font-semibold bg-orange text-white rounded-[8px] px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
            >
              {busy ? t("push.enabling") : t("push.allow")}
            </button>
            <button
              onClick={dismiss}
              disabled={busy}
              className="text-[11.5px] font-semibold text-[#C7CBC7] px-2 py-1.5"
            >
              {t("push.notNow")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
