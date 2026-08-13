"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

// Captures the browser's install prompt and shows our own button instead
// of relying on default browser UI. Also registers the service worker.
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/service-worker.js").catch(() => {
          // fails silently outside HTTPS/production — expected in local dev sometimes
        });
      });
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch {
      // prompt can throw if the event is no longer valid — ignore
    } finally {
      setDeferredPrompt(null);
      setVisible(false);
    }
  };

  return (
    <button
      onClick={handleInstall}
      className="fixed bottom-4 right-4 font-mono text-[11.5px] font-semibold bg-orange text-white rounded-full px-4 py-2 shadow-lg z-50"
    >
      ⬇ Install app
    </button>
  );
}
