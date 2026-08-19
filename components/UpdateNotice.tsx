"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

// One-time "what's new" popup. Shown once per browser after the update that
// shipped the Aug 19 fixes (role switch, delete account, request privacy,
// fair pricing). A permanent flag stops it from reappearing.
const NOTICE_KEY = "jomcod_update_v1";

const ITEMS = ["update.item1", "update.item2", "update.item4", "update.item5"];

export default function UpdateNotice() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(NOTICE_KEY) === "1") return;
    } catch {
      return;
    }
    const timer = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(NOTICE_KEY, "1");
    } catch {
      // ignore storage errors
    }
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-paper border border-line rounded-[18px] w-full max-w-[360px] p-5 shadow-2xl">
        <div className="text-[16px] font-bold font-display mb-1">{t("update.title")}</div>
        <div className="text-[12px] text-slate mb-3.5 leading-snug">{t("update.sub")}</div>
        <ul className="space-y-3 text-[13px] text-ink">
          {ITEMS.map((key) => (
            <li key={key} className="flex gap-2.5">
              <span className="w-6 h-6 flex-shrink-0 rounded-full bg-orange text-white text-[11px] font-bold flex items-center justify-center">
                ✓
              </span>
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
        <button
          onClick={dismiss}
          className="w-full mt-5 bg-ink text-paper rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold"
        >
          {t("update.gotIt")}
        </button>
      </div>
    </div>
  );
}
