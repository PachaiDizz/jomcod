"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const STORAGE_KEY = "jomcod_install_dismissed";

// Mobile install nudge. On Android/Chrome it triggers the native install
// prompt; on iOS (no beforeinstallprompt event) it shows share-sheet
// instructions instead. Dismissed choice is remembered so it doesn't nag.
export default function InstallBanner() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      // ignore storage errors
    }

    const ua = navigator.userAgent;
    const mobile =
      /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ||
      (navigator.maxTouchPoints > 0 && /Windows/i.test(ua));
    if (!mobile) return;

    const iOS = /iPad|iPhone|iPod/i.test(ua);
    setIsIOS(iOS);

    // Android/Chrome: wait for the native prompt, then show the banner.
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    if (iOS) {
      // iOS never fires beforeinstallprompt — show share-sheet instructions.
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore storage errors
    }
    setVisible(false);
  };

  const handleInstall = async () => {
    if (!deferred) return;
    try {
      deferred.prompt();
      await deferred.userChoice;
    } catch {
      // prompt can throw if the event is no longer valid — ignore
    } finally {
      dismiss();
    }
  };

  return (
    <div className="fixed bottom-4 inset-x-4 md:inset-x-auto md:right-4 md:left-auto md:max-w-sm z-50 bg-ink text-paper rounded-[14px] p-3.5 shadow-[0_20px_50px_-16px_rgba(28,35,33,0.5)] border border-white/10">
      <div className="text-[12.5px] font-bold font-display mb-0.5">{t("install.banner")}</div>
      <div className="text-[11.5px] text-[#C7CBC7] leading-snug mb-3">
        {isIOS ? t("install.how") : t("install.bannerBody")}
      </div>
      <div className="flex gap-2">
        {isIOS ? (
          <button
            onClick={dismiss}
            className="flex-1 bg-orange text-white rounded-[9px] px-3 py-2 text-[12px] font-semibold"
          >
            {t("install.later")}
          </button>
        ) : (
          <>
            <button
              onClick={handleInstall}
              className="flex-1 bg-orange text-white rounded-[9px] px-3 py-2 text-[12px] font-semibold"
            >
              {t("install.install")}
            </button>
            <button
              onClick={dismiss}
              className="px-3 py-2 text-[12px] text-[#C7CBC7] hover:text-paper transition-colors"
            >
              {t("install.later")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
