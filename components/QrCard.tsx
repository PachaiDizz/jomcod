"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Renders a scannable QR code for the current site origin (works on any
// deployment/custom domain automatically). Generated client-side as an SVG.
export default function QrCard() {
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

  if (!svg) return null;

  return (
    <div
      className="inline-block bg-white p-2.5 rounded-[10px] border border-line shadow-sm"
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-label="JomCOD QR code"
    />
  );
}
