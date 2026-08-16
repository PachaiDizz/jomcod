"use client";

import { formatDelivery, formatTakeFromLines } from "@/lib/jobFormat";
import type { JobRequest } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

// Organized route display shared across every card so pickup couriers/locations,
// the delivery address and the receiver name/phone are always clearly separated.
//
// variant="block"   → sectioned block (Pickup / Delivery + receiver)
// variant="current" → labeled rows for the runner's Current Job card:
//                     Courier / Pickup · Address · Receiver Name · Phone Number
export default function RouteInfo({
  job,
  variant = "block",
}: {
  job: JobRequest;
  variant?: "block" | "current";
}) {
  const { t } = useI18n();
  const takeLines = formatTakeFromLines(job.takeFrom);
  const delivery = formatDelivery(job.deliverTo);
  const isCourier = takeLines.length > 1 || /×\s*\d+\s*item/i.test(job.takeFrom);

  if (variant === "current") {
    return (
      <div className="mt-3 rounded-[10px] bg-paper2 border border-line px-3 py-2.5 space-y-1.5">
        <div className="text-[12px] leading-snug">
          <span className="text-slate">
            {isCourier ? t("route.courier") : t("route.pickup") + ":"}
          </span>
          {takeLines.length === 0 ? (
            <span className="text-ink break-words"> {job.takeFrom || "—"}</span>
          ) : (
            <div className="mt-0.5 space-y-0.5">
              {takeLines.map((l, i) => (
                <div key={i} className="text-ink break-words">
                  {l}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="text-[12px] leading-snug">
          <span className="text-slate">{t("route.address")}</span>{" "}
          <span className="text-ink break-words">{delivery.address}</span>
        </div>
        {delivery.receiverName && (
          <div className="text-[12px] leading-snug">
            <span className="text-slate">{t("route.receiverName")}</span>{" "}
            <span className="text-ink break-words">{delivery.receiverName}</span>
          </div>
        )}
        {delivery.receiverPhone && (
          <div className="text-[12px] leading-snug">
            <span className="text-slate">{t("route.phoneNumber")}</span>{" "}
            <span className="text-ink">{delivery.receiverPhone}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-[10px] bg-paper2 border border-line px-3 py-2.5 space-y-2.5">
      <div>
        <span className="text-[9.5px] font-semibold uppercase tracking-wide text-slate block mb-0.5">
          {t("route.pickup")}
        </span>
        {takeLines.length === 0 ? (
          <div className="text-[12px] text-ink leading-snug break-words">
            {job.takeFrom || "—"}
          </div>
        ) : (
          <div className="space-y-0.5">
            {takeLines.map((l, i) => (
              <div key={i} className="text-[12px] text-ink leading-snug break-words">
                {l}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="border-t border-line/70 pt-2">
        <span className="text-[9.5px] font-semibold uppercase tracking-wide text-slate block mb-0.5">
          {t("route.delivery")}
        </span>
        <div className="text-[12px] text-ink leading-snug break-words">
          {delivery.address}
        </div>
        {delivery.receiverName && (
          <div className="text-[11.5px] text-slate leading-snug mt-0.5 break-words">
            {t("route.receiver")}{" "}
            <span className="text-ink">{delivery.receiverName}</span>
            {delivery.receiverPhone && (
              <span className="text-ink"> · {delivery.receiverPhone}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
