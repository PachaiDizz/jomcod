"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/Button";
import Md from "@/components/Md";
import { useI18n } from "@/lib/i18n";

export type GuideRole = "runner" | "community";

const STEPS: Record<GuideRole, number> = { runner: 6, community: 5 };
const SAFE: Record<GuideRole, number> = { runner: 5, community: 6 };
const INTRO: Record<GuideRole, number> = { runner: 2, community: 3 };

// Role-specific "how things work" guide shown before someone signs up, and
// re-openable from the nav. Which guide you see matches the role you picked
// (or the role of the signed-in user).
export default function JoinGuideModal({
  onAccept,
  onClose,
  acceptLabel,
  role = "community",
}: {
  onAccept: () => void;
  onClose?: () => void;
  acceptLabel?: string;
  role?: GuideRole;
}) {
  const { t } = useI18n();
  const k = role === "runner" ? "gr" : "gc";

  // Portal to <body> so `fixed inset-0` always covers the whole viewport —
  // inside any sticky/backdrop-blur ancestor, fixed positioning would be
  // relative to that ancestor instead of the screen.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const content = (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[70] bg-black/50" />

      {/* Modal layer */}
      <div className="fixed inset-0 z-[71] overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-4">
          <div className="bg-paper border border-line rounded-[20px] w-full max-w-[520px] p-5 md:p-7 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[19px] md:text-[22px] font-bold font-display">
                {t(`${k}.title`)}
              </div>
              <button
                type="button"
                aria-label={t("common.cancel")}
                onClick={() => (onClose ? onClose() : onAccept())}
                className="w-8 h-8 flex-shrink-0 rounded-full bg-line/50 hover:bg-line flex items-center justify-center text-[15px] text-slate hover:text-ink"
              >
                ✕
              </button>
            </div>
            <p className="text-[12.5px] leading-relaxed text-slate mt-1 mb-4">
              {t(`${k}.sub`)}
            </p>

            <div className="space-y-4 text-[13px] leading-relaxed text-ink">
              {Array.from({ length: INTRO[role] }, (_, i) => (
                <p key={i}>
                  <Md text={t(`${k}.intro${i + 1}`)} />
                </p>
              ))}

              <div className="font-bold">{t(`${k}.howTitle`)}</div>
              <ol className="list-decimal pl-5 space-y-1">
                {Array.from({ length: STEPS[role] }, (_, i) => (
                  <li key={i}>
                    <b>{t(`${k}.step${i + 1}`)}</b> — {t(`${k}.step${i + 1}Desc`)}
                  </li>
                ))}
              </ol>

              <div className="rounded-xl border border-teal/30 bg-teal/[0.06] px-4 py-3">
                <div className="font-bold mb-1.5">{t(`${k}.parcelTitle`)}</div>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <Md text={t(`${k}.parcel1`)} />
                  </li>
                  <li>
                    <Md text={t(`${k}.parcel2`)} />
                  </li>
                  <li>
                    <Md text={t(`${k}.parcel3`)} />
                  </li>
                </ul>
              </div>

              <div className="font-bold">{t(`${k}.payTitle`)}</div>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <Md text={t(`${k}.pay1`)} />
                </li>
                <li>
                  <Md text={t(`${k}.pay2`)} />
                </li>
              </ul>

              <div className="font-bold">{t(`${k}.safeTitle`)}</div>
              <ul className="list-disc pl-5 space-y-1.5">
                {Array.from({ length: SAFE[role] }, (_, i) => (
                  <li key={i}>
                    <Md text={t(`${k}.safe${i + 1}`)} />
                  </li>
                ))}
              </ul>

              <div className="font-bold">{t(`${k}.goodTitle`)}</div>
              <p>
                <Md text={t(`${k}.good1`)} />
              </p>
              <p className="text-slate">
                <Md text={t(`${k}.good2`)} />
              </p>

              <p className="font-bold text-center pt-1">
                <Md text={t(`${k}.footer`)} />
              </p>
            </div>

            <div className="mt-5">
              <Button onClick={onAccept}>{acceptLabel ?? t("guide.accept")}</Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (typeof window === "undefined") return null;
  return createPortal(content, document.body);
}
