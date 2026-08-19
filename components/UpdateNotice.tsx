"use client";

import { useEffect, useState } from "react";
import Md from "@/components/Md";
import { useI18n } from "@/lib/i18n";
import { APP_VERSION } from "@/lib/version";

// One-time "what's new" popup, shown once per browser PER APP VERSION. Bump
// APP_VERSION in lib/version.ts on every release and this re-appears with the
// new notes; the flag key includes the version so older flags don't block it.
const noticeKey = () => `jomcod_update_${APP_VERSION}`;

const ITEMS = ["update.item1", "update.item2", "update.item4", "update.item5"];

export default function UpdateNotice() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(noticeKey()) === "1") return;
    } catch {
      return;
    }
    const timer = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(noticeKey(), "1");
    } catch {
      // ignore storage errors
    }
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-paper border border-line rounded-[18px] w-full max-w-[360px] p-5 shadow-2xl">
        <div className="text-[16px] font-bold font-display mb-1">
          {t("update.title", { version: APP_VERSION })}
        </div>
        <div className="text-[12px] text-slate mb-3.5 leading-snug">{t("update.sub")}</div>
        <ul className="space-y-3 text-[13px] text-ink">
          {ITEMS.map((key) => (
            <li key={key} className="flex gap-2.5">
              <span className="w-6 h-6 flex-shrink-0 rounded-full bg-orange text-white text-[11px] font-bold flex items-center justify-center">
                ✓
              </span>
              <span className="leading-snug">
                <Md text={t(key)} />
              </span>
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
