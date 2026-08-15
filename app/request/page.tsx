"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import PhoneFrame from "@/components/PhoneFrame";
import Button from "@/components/Button";
import RequestFields, {
  REQUEST_SERVICE_OPTIONS,
  buildDeliverTo,
  buildNotes,
  buildTakeFrom,
  estimateTotal,
} from "@/components/RequestFields";
import { cleanServiceName, formatRM } from "@/lib/constants";
import { pricingLabel } from "@/lib/mockData";
import { createJob, fetchRunners, getProfile } from "@/lib/queries";
import type { RequestDetails } from "@/components/RequestFields";
import type { Runner } from "@/lib/types";

function RequestForm() {
  const params = useSearchParams();
  const [runners, setRunners] = useState<Runner[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchRunners().then((list) => {
      setRunners(list);
      setLoaded(true);
    });
  }, []);

  const runnerId = params.get("runner");
  const runner = runnerId
    ? runners.find((r) => r.id === runnerId)
    : runners.length > 0
    ? runners[0]
    : undefined;

  const [status, setStatus] = useState<"idle" | "pending" | "expired">("idle");
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [details, setDetails] = useState<RequestDetails>({
    serviceType: params.get("service") ?? "",
    couriers: [{ courier: "", qty: "" }],
    pickupLocation: params.get("take") ?? "",
    deliveryArea: params.get("area") ?? "",
    sahabat: params.get("sahabat") ?? "",
    noRumah: params.get("no") ?? "",
    unit: params.get("unit") ?? "",
    block: params.get("block") ?? "",
    receiverName: params.get("sign") ?? "",
    receiverPhone: "",
    items: [{ name: "", qty: "" }],
    itemsText: params.get("notes") ?? "",
    extraServices: [],
    deliveryTime: "asap",
    preferredTime: "",
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Prefill the delivery address from the user's saved profile when nothing
  // was passed in (e.g. from a re-request link).
  useEffect(() => {
    if (params.get("area") || params.get("sahabat") || params.get("no") || params.get("sign")) return;
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

  const serviceOptions =
    runner && runner.services.length > 0
      ? Array.from(new Set(runner.services.map((s) => cleanServiceName(s.name))))
      : REQUEST_SERVICE_OPTIONS;

  const pricingFor = (serviceType: string) =>
    runner?.services.find((s) => cleanServiceName(s.name) === serviceType)?.pricing;

  // The dropdown defaults to the first service option before the user touches
  // it — calculate against that effective choice so the total is never RM0.
  const effectiveService = details.serviceType || serviceOptions[0];
  const estimate = runner
    ? estimateTotal({ ...details, serviceType: effectiveService }, pricingFor)
    : 0;

  const sendRequest = async () => {
    setError("");
    if (!runner) return;
    const baseService = details.serviceType || serviceOptions[0];
    const extraNames = details.extraServices.map((e) => e.serviceType || "");
    const serviceType = [baseService, ...extraNames].filter(Boolean).join(" + ");
    const takeFrom = buildTakeFrom(details);
    const deliverTo = buildDeliverTo(details);
    if (!takeFrom || !deliverTo) {
      setError("Please fill in pickup and delivery details.");
      return;
    }
    setSending(true);
    const res = await createJob({
      serviceType,
      takeFrom,
      deliverTo,
      notes: buildNotes({ ...details, serviceType: effectiveService }, estimate),
      runnerId: runner.id,
    });
    setSending(false);
    if (!res.ok) {
      setError(res.message ?? "Couldn't save your request. Please try again.");
      return;
    }
    setStatus("pending");
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

  if (!runner) {
    return (
      <PhoneFrame narrow>
        <div className="flex bg-paper2 rounded-[10px] p-[3px] mb-4">
          <div className="flex-1 text-center py-2.5 text-xs font-semibold rounded-lg bg-white text-ink shadow-sm">
            Direct request
          </div>
          <Link
            href="/broadcast"
            className="flex-1 text-center py-2.5 text-xs font-semibold rounded-lg text-ink hover:bg-white/60"
          >
            Broadcast to all
          </Link>
        </div>

        <div className="text-[19px] font-bold mb-1 font-display">Request a runner</div>
        <div className="text-[12.5px] text-slate mb-4.5">Fill in your errand details</div>

        <div className="text-center bg-white border border-dashed border-line rounded-card px-5 py-10 mb-3.5">
          <div className="text-3xl mb-2.5">🧑‍🤝‍🧑</div>
          <div className="font-display font-bold text-[16px] mb-1">Pick a runner first</div>
          <div className="text-[12px] text-slate leading-relaxed mb-4">
            Direct requests go to one specific runner. Head to Browse and choose someone nearby,
            or broadcast to everyone at once.
          </div>
          <Link href="/browse" className="w-full block">
            <Button>Find a runner</Button>
          </Link>
        </div>
      </PhoneFrame>
    );
  }

  const firstService = runner.services[0];

  return (
    <PhoneFrame narrow>
      <div className="flex bg-paper2 rounded-[10px] p-[3px] mb-4">
        <div className="flex-1 text-center py-2.5 text-xs font-semibold rounded-lg bg-white text-ink shadow-sm">
          Direct request
        </div>
        <Link
          href="/broadcast"
          className="flex-1 text-center py-2.5 text-xs font-semibold rounded-lg text-ink hover:bg-white/60"
        >
          Broadcast to all
        </Link>
      </div>

      <div className="text-[19px] font-bold mb-1 font-display">Request {runner.name}</div>
      <div className="text-[12.5px] text-slate mb-4.5">Fill in your errand details</div>

      <RequestFields
        details={details}
        onChange={setDetails}
        serviceOptions={serviceOptions}
        pricingFor={pricingFor}
      />

      {error && (
        <div className="text-[12px] text-orange bg-[#FDEFE3] rounded-[10px] px-3 py-2 mb-3">
          {error}
        </div>
      )}

      {firstService && (
        <div className="bg-white border border-line rounded-[12px] px-3.5 py-3 my-3.5">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xs text-slate mb-1">{runner.name.split(" ")[0]}&apos;s pricing</div>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-paper2 text-ink">
                {pricingLabel(firstService.pricing.model)}
              </span>
            </div>
            <span className="font-mono font-bold text-[17px]">
              {firstService.pricing.model === "custom"
                ? firstService.pricing.description
                : formatRM(firstService.pricing.price)}
            </span>
          </div>
          <div className="text-[11px] text-slate mt-1.5">
            You&apos;ll only pay after the job is done — no upfront payment needed.
          </div>
        </div>
      )}

      <Button onClick={sendRequest} disabled={sending}>
        {sending ? "Sending…" : "Send request"}
      </Button>

      {status !== "idle" && (
        <div className="bg-ink text-paper rounded-card p-4.5 text-center my-3.5">
          <div className="text-xs text-[#B8BDB9]">
            {status === "pending" ? `Waiting for ${runner.name.split(" ")[0]} to accept` : ""}
          </div>
          <div className="font-mono text-[34px] font-semibold my-1.5 text-orange">
            {mm}:{ss}
          </div>
          <div className="text-xs text-[#B8BDB9]">
            {status === "expired"
              ? "Expired — no response from runner"
              : "Request auto-expires if no response"}
          </div>
        </div>
      )}

      {status === "expired" && (
        <div className="flex gap-2 mt-3.5">
          <Link href="/browse" className="w-full">
            <Button variant="outline">Find another runner</Button>
          </Link>
          <Link href="/broadcast" className="w-full">
            <Button variant="secondary">Broadcast instead</Button>
          </Link>
        </div>
      )}

      <div className="text-[11.5px] text-slate bg-paper2 rounded-lg px-3 py-2.5 mt-2.5 italic">
        If {runner.name.split(" ")[0]} doesn&apos;t respond in 5 minutes, this request
        auto-revokes. You can then pick another runner directly, or broadcast to everyone
        available.
      </div>
    </PhoneFrame>
  );
}

export default function RequestPage() {
  return (
    <Suspense fallback={null}>
      <RequestForm />
    </Suspense>
  );
}
