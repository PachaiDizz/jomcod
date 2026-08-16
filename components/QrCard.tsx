"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useI18n } from "@/lib/i18n";

// Renders a scannable QR code for the current site origin (works on any
// deployment/custom domain automatically). Generated client-side as an SVG,
// with a native share button so visitors can send the link straight away.
export default function QrCard() {
  const { t } = useI18n();
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let cancelled = false;
    const url = window.location.origin;
    QRCode.toString(url, { type: "svg", margin: 1, width: 260, errorCorrectionLevel: "M" })
      .then((data) => {
        if (!cancelled) setSvg(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleShare = async () => {
    const url = window.location.origin;
    const canShare =
      typeof navigator !== "undefined" && typeof navigator.share === "function";
    if (canShare) {
      try {
        await navigator.share({ title: "JomCOD", url });
        return;
      } catch {
        // user cancelled or share failed — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      alert(url);
    } catch {
      // clipboard unavailable — nothing else to do
    }
  };

  if (!svg) return null;

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div
        className="inline-block bg-white p-2.5 rounded-[10px] border border-line shadow-sm"
        dangerouslySetInnerHTML={{ __html: svg }}
        aria-label="JomCOD QR code"
      />
      <button
        onClick={handleShare}
        className="font-mono text-[11.5px] font-semibold bg-orange text-white rounded-full px-4 py-2 hover:bg-orange/90 transition-colors"
      >
        {t("qr.share")}
      </button>
    </div>
  );
}
