"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/Button";
import { useI18n } from "@/lib/i18n";

// Full "before you join" guide shown as a modal the FIRST time someone tries
// to sign up. Once accepted it is remembered (localStorage) so it never
// blocks them again.
export default function JoinGuideModal({
  onAccept,
  onClose,
  acceptLabel,
}: {
  onAccept: () => void;
  onClose?: () => void;
  acceptLabel?: string;
}) {
  const { t } = useI18n();

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
                {t("guide.title")}
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
              {t("guide.sub")}
            </p>

            <div className="space-y-4 text-[13px] leading-relaxed text-ink">
              <p>{t("guide.p1")}</p>
              <p>
                {t("guide.p2")} <b>{t("guide.p2Bold")}</b>
              </p>
              <p>{t("guide.p3")}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{t("guide.list1")}</li>
                <li>{t("guide.list2")}</li>
                <li>{t("guide.list3")}</li>
                <li>{t("guide.list4")}</li>
                <li>{t("guide.list5")}</li>
              </ul>
              <p>
                {t("guide.p4")} <b>{t("guide.p4Bold")}</b>
              </p>
              <p>
                {t("guide.p5")} <b>{t("guide.p5Bold")}</b> {t("guide.p5Post")}
              </p>

              <div className="rounded-xl border border-teal/30 bg-teal/[0.06] px-4 py-3">
                <div className="font-bold mb-1.5">{t("guide.openTo")}</div>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Felda Desa Kencana</li>
                  <li>Felda Wilayah Sahabat</li>
                </ul>
              </div>

              <div className="font-bold">{t("guide.howWorks")}</div>
              <ol className="list-decimal pl-5 space-y-1">
                <li>{t("guide.step1")}</li>
                <li>{t("guide.step2")}</li>
                <li>{t("guide.step3")}</li>
                <li>{t("guide.step4")}</li>
                <li>{t("guide.step5")}</li>
              </ol>

              <div className="font-bold">{t("guide.reminders")}</div>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  {t("guide.r1")} <b>{t("guide.r1Bold")}</b>.
                </li>
                <li>
                  {t("guide.r2")} <b>{t("guide.r2Bold")}</b>
                </li>
                <li>
                  {t("guide.r3")} <b>{t("guide.r3Bold")}</b>. {t("guide.r3Post")}
                </li>
                <li>
                  {t("guide.r4")} <b>{t("guide.r4Bold")}</b> {t("guide.r4Post")}
                </li>
                <li>
                  {t("guide.r5")} <b>{t("guide.r5Bold")}</b> {t("guide.r5Post")}
                </li>
                <li>
                  {t("guide.r6")} <b>{t("guide.r6Bold")}</b> {t("guide.r6Post")}
                </li>
                <li>
                  {t("guide.r7")} <b>{t("guide.r7Bold")}</b>.
                </li>
              </ul>

              <p>
                {t("guide.p6")} <b>{t("guide.p6Bold")}</b>
              </p>
              <p className="text-slate">
                {t("guide.p7")} <b className="text-ink">{t("guide.p7Bold")}</b>
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
