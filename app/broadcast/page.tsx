"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import PhoneFrame from "@/components/PhoneFrame";
import Button from "@/components/Button";
import RequestFields, {
  REQUEST_SERVICE_OPTIONS,
  buildDeliverTo,
  buildNotes,
  buildTakeFrom,
} from "@/components/RequestFields";
import { createJob, fetchRunners, getProfile } from "@/lib/queries";
import type { RequestDetails } from "@/components/RequestFields";
import type { Runner } from "@/lib/types";

function BroadcastForm() {
  const params = useSearchParams();
  const [recipients, setRecipients] = useState<Runner[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<"idle" | "running" | "expired">("idle");
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [details, setDetails] = useState<RequestDetails>({
    serviceType: params.get("service") ?? "",
    couriers: [{ courier: "", qty: "" }],
    pickupLocation: "",
    deliveryArea: "",
    sahabat: "",
    noRumah: "",
    unit: "",
    block: "",
    receiverName: "",
    receiverPhone: "",
    items: [{ name: "", qty: "", price: "" }],
    itemsText: "",
    extraServices: [],
    deliveryTime: "asap",
    preferredTime: "",
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchRunners().then((list) => {
      setRecipients(list);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Prefill the delivery address from the user's saved profile.
  useEffect(() => {
    getProfile().then((p) => {
      if (!p) return;
      setDetails((prev) => ({
        ...prev,
        deliveryArea: prev.deliveryArea || p.area || "",
        sahabat: prev.sahabat || p.sahabat || "",
        noRumah: prev.noRumah || p.no_rumah || "",
        block: prev.block || p.block || "",
      }));
    });
  }, []);

  const startBroadcast = async () => {
    setError("");
    const deliver = buildDeliverTo(details);
    if (!buildTakeFrom(details) || !deliver) {
      setError("Please fill in pickup and delivery details.");
      return;
    }
    setSending(true);
    const baseService =
      details.serviceType === "Other"
        ? "Other Errand"
        : details.serviceType || REQUEST_SERVICE_OPTIONS[0];
    const extraNames = details.extraServices.map((e) =>
      e.serviceType === "Other" ? "Other Errand" : e.serviceType || ""
    );
    const serviceType = [baseService, ...extraNames].filter(Boolean).join(" + ");
    const res = await createJob({
      serviceType,
      takeFrom: buildTakeFrom(details),
      deliverTo: deliver,
      notes: buildNotes(details),
      runnerId: null,
    });
    setSending(false);
    if (!res.ok) {
      setError(res.message ?? "Couldn't save your request. Please try again.");
      return;
    }
    setStatus("running");
    setSecondsLeft(300);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setStatus("expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  if (!loaded) {
    return (
      <PhoneFrame narrow>
        <div className="text-center py-10 text-[12.5px] text-slate">Loading…</div>
      </PhoneFrame>
    );
  }

  const tabs = (
    <div className="flex bg-paper2 rounded-[10px] p-[3px] mb-4">
      <Link
        href="/request"
        className="flex-1 text-center py-2.5 text-xs font-semibold rounded-lg text-ink hover:bg-white/60"
      >
        Direct request
      </Link>
      <div className="flex-1 text-center py-2.5 text-xs font-semibold rounded-lg bg-white text-ink shadow-sm">
        Broadcast to all
      </div>
    </div>
  );

  if (recipients.length === 0) {
    return (
      <PhoneFrame narrow>
        {tabs}
        <div className="text-[19px] font-bold mb-1 font-display">Broadcast request</div>
        <div className="text-[12.5px] text-slate mb-4.5">
          Sent to every available runner nearby — first to accept gets the job
        </div>
        <div className="text-center bg-white border border-dashed border-line rounded-card px-5 py-10 mb-3.5">
          <div className="text-3xl mb-2.5">📣</div>
          <div className="font-display font-bold text-[16px] mb-1">No available runners yet</div>
          <div className="text-[12px] text-slate leading-relaxed mb-4">
            There&apos;s no one to broadcast to in your area right now. Check back soon, or be the
            first to offer a hand to your neighbours.
          </div>
          <Link href="/browse" className="w-full block">
            <Button>Find a runner</Button>
          </Link>
        </div>
      </PhoneFrame>
    );
  }

  const statusMessage =
    status === "expired"
      ? "No one accepted in time"
      : "Waiting for someone to accept";

  return (
    <PhoneFrame narrow>
      {tabs}

      <div className="text-[19px] font-bold mb-1 font-display">Broadcast request</div>
      <div className="text-[12.5px] text-slate mb-4.5">
        Sent to every available runner nearby — first to accept gets the job
      </div>

      <RequestFields details={details} onChange={setDetails} />

      {error && (
        <div className="text-[12px] text-orange bg-[#FDEFE3] rounded-[10px] px-3 py-2 mb-3">
          {error}
        </div>
      )}

      <div className="bg-paper2 rounded-[10px] px-3.5 py-3 mb-3.5">
        <div className="text-[11.5px] text-slate italic">
          Pricing varies by runner — you&apos;ll see the accepted runner&apos;s price to confirm
          before the job starts.
        </div>
        <div className="text-[11px] text-slate mt-1.5">
          You&apos;ll only pay after the job is done — no upfront payment needed.
        </div>
      </div>

      <Button onClick={startBroadcast} disabled={sending}>
        {sending ? "Sending…" : `⚡ Broadcast to ${recipients.length} available runners`}
      </Button>

      {status !== "idle" && (
        <div className="bg-ink text-paper rounded-card p-4.5 text-center my-3.5">
          <div className="text-xs text-[#B8BDB9]">{statusMessage}</div>
          <div className="font-mono text-[34px] font-semibold my-1.5 text-orange">
            {mm}:{ss}
          </div>
          <div className="text-xs text-[#B8BDB9]">
            First runner to accept gets the job — others are notified it&apos;s taken
          </div>
        </div>
      )}

      {status !== "idle" && (
        <>
          <div className="text-[11px] font-mono uppercase tracking-wide text-slate mt-4 mb-2">
            Goes to all runners — {recipients.length} in the network right now
          </div>
          <div className="flex flex-wrap mb-1.5">
            {recipients.slice(0, 8).map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-1.5 border rounded-full pl-1.5 pr-2.5 py-1 text-[11px] mr-1.5 mb-1.5 bg-white border-line"
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold font-display"
                  style={{ background: r.avatarColor }}
                >
                  {r.avatarInitials}
                </span>
                {r.name}
              </div>
            ))}
            {recipients.length > 8 && (
              <div className="text-[11px] text-slate py-1.5">
                +{recipients.length - 8} more
              </div>
            )}
          </div>
        </>
      )}

      {status === "expired" && (
        <Link href="/browse" className="block mt-3.5">
          <Button variant="outline">Back to browse</Button>
        </Link>
      )}
    </PhoneFrame>
  );
}

export default function BroadcastPage() {
  return (
    <Suspense fallback={null}>
      <BroadcastForm />
    </Suspense>
  );
}
