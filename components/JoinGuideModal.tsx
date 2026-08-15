"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/Button";

// Full "before you join" guide shown as a modal the FIRST time someone tries
// to sign up. Once accepted it is remembered (localStorage) so it never
// blocks them again.
export default function JoinGuideModal({
  onAccept,
  onClose,
  acceptLabel = "I've read it — let me sign up",
}: {
  onAccept: () => void;
  onClose?: () => void;
  acceptLabel?: string;
}) {
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
                📋 Before you join
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => (onClose ? onClose() : onAccept())}
                className="w-8 h-8 flex-shrink-0 rounded-full bg-line/50 hover:bg-line flex items-center justify-center text-[15px] text-slate hover:text-ink"
              >
                ✕
              </button>
            </div>
            <p className="text-[12.5px] leading-relaxed text-slate mt-1 mb-4">
              Please take a moment to read this.
            </p>

            <div className="space-y-4 text-[13px] leading-relaxed text-ink">
              <p>
                <b>JomCOD</b> is a small project connecting neighbours who need
                a helping hand with everyday errands.
              </p>
              <p>
                The idea is simple:{" "}
                <b>make it easier for our community to know who is available to help.</b>
              </p>
              <p>
                Without <b>JomCOD</b>, it can be difficult to know:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Who is currently a runner?</li>
                <li>Who is available right now?</li>
                <li>Who is free to pick up a parcel?</li>
                <li>Who can help with groceries or a small errand?</li>
                <li>Who can I ask nearby?</li>
              </ul>
              <p>
                <b>JomCOD</b> brings this information together in one place, so
                you can <b>see who&apos;s available, what they can help with, and get
                in touch with them more easily.</b>
              </p>
              <p>
                Think of it as <b>friends helping friends</b> — not a company, not
                a marketplace, and no middleman.
              </p>

              <div className="rounded-xl border border-teal/30 bg-teal/[0.06] px-4 py-3">
                <div className="font-bold mb-1.5">📍 Currently open to</div>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Felda Desa Kencana</li>
                  <li>Felda Wilayah Sahabat</li>
                </ul>
              </div>

              <div className="font-bold">How it works</div>
              <ol className="list-decimal pl-5 space-y-1">
                <li><b>Find a nearby runner</b> who&apos;s available</li>
                <li><b>Check what they can help with</b></li>
                <li><b>Send your request</b></li>
                <li>Once the runner accepts, <b>chat and coordinate through WhatsApp</b></li>
                <li><b>Task done</b> — simple as that</li>
              </ol>

              <div className="font-bold">A few gentle reminders</div>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  For now, <b>JomCOD</b> is only available in the areas above —
                  we&apos;re keeping it <b>local and close-knit</b>.
                </li>
                <li>
                  Treat others the way you&apos;d want to be treated.{" "}
                  <b>This is your community.</b>
                </li>
                <li>
                  Any payment is arranged <b>directly between you and the runner</b>.
                  <b>JomCOD</b> does not collect or process payments.
                </li>
                <li>
                  We don&apos;t run background checks, so please use your own judgement.
                  Meet in <b>safe, familiar places</b> and let us know if something
                  doesn&apos;t feel right.
                </li>
                <li>
                  Runners are <b>reviewed and approved by a JomCOD admin</b> before
                  they can accept requests.
                </li>
                <li>
                  Never share your <b>passwords, OTPs, banking details, or other
                  sensitive information</b> with another user.
                </li>
                <li>
                  If you experience inappropriate behaviour, suspicious activity,
                  or anything that makes you uncomfortable,{" "}
                  <b>please report it to the JomCOD admin</b>.
                </li>
              </ul>

              <p>
                That&apos;s really it. The goal is simple:{" "}
                <b>make it easier for neighbours to find someone nearby who&apos;s
                available to help.</b>
              </p>
              <p className="text-slate">
                Thanks for being part of this —{" "}
                <b className="text-ink">hope JomCOD makes life a little easier around here. 🙏</b>
              </p>
            </div>

            <div className="mt-5">
              <Button onClick={onAccept}>{acceptLabel}</Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (typeof window === "undefined") return null;
  return createPortal(content, document.body);
}
