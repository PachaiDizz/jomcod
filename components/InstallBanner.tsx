"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

// Mobile install nudge.
//  - Android/Chrome: auto-triggers the native install prompt once.
//  - iOS: shows a step-by-step guide (Apple provides no install API and the
//    JS share sheet does NOT include "Add to Home Screen" — only Safari's
//    own menu does, so we walk the user through it).
// Once installed, a permanent flag stops the banner forever — even if the
// site is later opened in a normal browser tab (not standalone).
const INSTALLED_KEY = "jomcod_installed";
const DISMISSED_KEY = "jomcod_install_dismissed";

export default function InstallBanner() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    // Running inside the installed PWA (standalone) → installed for good.
    try {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as { standalone?: boolean }).standalone === true;
      if (standalone) {
        localStorage.setItem(INSTALLED_KEY, "1");
        return;
      }
    } catch {
      // ignore
    }

    // Already installed before (even if opened in a normal tab now) → no nudge.
    try {
      if (localStorage.getItem(INSTALLED_KEY) === "1") return;
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

    if (iOS) {
      // iOS never fires beforeinstallprompt — show the guide after a beat.
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }

    // Android/Chrome: capture the install event, then show the banner. We do
    // NOT call prompt() here — firing it early consumes the event and makes
    // the "Install app" button a no-op later. prompt() runs only on tap.
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const handleInstall = async () => {
    if (!deferred) return;
    try {
      deferred.prompt();
      await deferred.userChoice;
      try {
        localStorage.setItem(INSTALLED_KEY, "1");
      } catch {
        // ignore
      }
    } catch {
      // prompt can throw if the event is no longer valid — ignore
    } finally {
      setVisible(false);
    }
  };

  const handleIOSInstall = () => {
    setShowGuide(true);
    setVisible(false);
  };

  // iOS step-by-step guide.
  if (showGuide) {
    return (
      <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
        <div className="bg-paper border border-line rounded-[18px] w-full max-w-[360px] p-5 shadow-2xl">
          <div className="text-[16px] font-bold font-display mb-1">{t("install.banner")}</div>
          <div className="text-[12px] text-slate mb-3.5 leading-snug">{t("install.iosIntro")}</div>
          <ol className="space-y-3 text-[13px] text-ink">
            <li className="flex gap-2.5">
              <span className="w-6 h-6 flex-shrink-0 rounded-full bg-orange text-white text-[11px] font-bold flex items-center justify-center">1</span>
              <span>{t("install.iosStep1")}</span>
            </li>
            <li className="flex gap-2.5">
              <span className="w-6 h-6 flex-shrink-0 rounded-full bg-orange text-white text-[11px] font-bold flex items-center justify-center">2</span>
              <span>{t("install.iosStep2")}</span>
            </li>
            <li className="flex gap-2.5">
              <span className="w-6 h-6 flex-shrink-0 rounded-full bg-orange text-white text-[11px] font-bold flex items-center justify-center">3</span>
              <span>{t("install.iosStep3")}</span>
            </li>
          </ol>
          <button
            onClick={() => setShowGuide(false)}
            className="w-full mt-5 bg-ink text-paper rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold"
          >
            {t("install.gotIt")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 inset-x-4 md:inset-x-auto md:right-4 md:left-auto md:max-w-sm z-50 bg-ink text-paper rounded-[14px] p-3.5 shadow-[0_20px_50px_-16px_rgba(28,35,33,0.5)] border border-white/10">
      <div className="text-[12.5px] font-bold font-display mb-0.5">{t("install.banner")}</div>
      <div className="text-[11.5px] text-[#C7CBC7] leading-snug mb-3">
        {isIOS ? t("install.how") : t("install.bannerBody")}
      </div>
      <div className="flex gap-2">
        <button
          onClick={isIOS ? handleIOSInstall : handleInstall}
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
      </div>
    </div>
  );
}
