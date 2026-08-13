import { useState } from "react";

export const REQUEST_SERVICE_OPTIONS = [
  "Grocery Run",
  "Parcel Pickup",
  "Food Pickup",
  "Document Delivery",
  "Other",
];

export interface RequestItem {
  name: string;
  qty: string;
}

export interface ParcelCourier {
  courier: string;
  qty: string;
}

export interface RequestDetails {
  serviceType: string;
  couriers: ParcelCourier[];
  pickupLocation: string;
  deliveryArea: string;
  houseNo: string;
  receiverName: string;
  receiverPhone: string;
  items: RequestItem[];
  itemsText: string;
  deliveryTime: "asap" | "today" | "scheduled";
  preferredTime: string;
}

export const EMPTY_REQUEST_DETAILS: RequestDetails = {
  serviceType: "",
  couriers: [{ courier: "", qty: "" }],
  pickupLocation: "",
  deliveryArea: "",
  houseNo: "",
  receiverName: "",
  receiverPhone: "",
  items: [{ name: "", qty: "" }],
  itemsText: "",
  deliveryTime: "asap",
  preferredTime: "",
};

const ITEM_LIST_SERVICES = ["grocery", "food", "buy", "shop"];

export const PARCEL_SERVICES = [
  "JNT",
  "SPX Express",
  "Ninja Van",
  "Pos Laju",
  "Flash",
  "GDEX",
  "DHL",
  "Best Express",
];

export function isItemListService(serviceType: string): boolean {
  const t = serviceType.toLowerCase();
  return ITEM_LIST_SERVICES.some((k) => t.includes(k));
}

export function isParcelService(serviceType: string): boolean {
  const t = serviceType.toLowerCase();
  return t.includes("parcel") && !t.includes("drop");
}

export function buildTakeFrom(d: RequestDetails): string {
  if (isParcelService(d.serviceType)) {
    const entries = d.couriers
      .filter((c) => c.courier.trim())
      .map((c) =>
        c.qty.trim() ? `${c.courier.trim()} ×${c.qty.trim()} item${c.qty.trim() === "1" ? "" : "s"}` : c.courier.trim()
      );
    return entries.length > 0 ? entries.join(", ") : "Parcel pickup";
  }
  return d.pickupLocation.trim();
}

export function buildDeliverTo(d: RequestDetails): string {
  const receiver = d.receiverName.trim();
  const receiverFull = receiver + (d.receiverPhone.trim() ? ` (${d.receiverPhone.trim()})` : "");
  return [d.deliveryArea.trim(), d.houseNo.trim(), receiverFull]
    .filter(Boolean)
    .join(" · ");
}

export function neededBy(d: RequestDetails): string {
  if (d.deliveryTime === "scheduled") {
    return d.preferredTime.trim() ? d.preferredTime.trim() : "Scheduled";
  }
  if (d.deliveryTime === "today") return "Today";
  return "ASAP";
}

export function buildNotes(d: RequestDetails): string {
  const lines: string[] = [];
  if (isItemListService(d.serviceType)) {
    const items = d.items.filter((i) => i.name.trim() && i.qty.trim());
    if (items.length > 0) {
      lines.push("Items: " + items.map((i) => `${i.name.trim()} ×${i.qty.trim()}`).join(", "));
    }
    if (d.itemsText.trim()) lines.push(d.itemsText.trim());
  } else {
    if (d.itemsText.trim()) lines.push(d.itemsText.trim());
  }
  lines.push(`Needed By: ${neededBy(d)}`);
  return lines.join("\n");
}

export function totalItemCount(d: RequestDetails): number {
  return d.items.reduce((sum, i) => sum + (parseInt(i.qty, 10) || 0), 0);
}

const INPUT_CLASS =
  "w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13.5px] mb-1.5";

export default function RequestFields({
  details,
  onChange,
  serviceOptions = REQUEST_SERVICE_OPTIONS,
}: {
  details: RequestDetails;
  onChange: (d: RequestDetails) => void;
  serviceOptions?: string[];
}) {
  const set = (patch: Partial<RequestDetails>) => onChange({ ...details, ...patch });
  const selected = details.serviceType || serviceOptions[0];
  const itemList = isItemListService(selected);

  const addItem = () =>
    set({ items: [...details.items, { name: "", qty: "" }] });
  const updateItem = (i: number, patch: Partial<RequestItem>) =>
    set({ items: details.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  const removeItem = (i: number) =>
    set({ items: details.items.filter((_, idx) => idx !== i) });

  const addCourier = () =>
    set({ couriers: [...details.couriers, { courier: "", qty: "" }] });
  const updateCourier = (i: number, patch: Partial<ParcelCourier>) =>
    set({ couriers: details.couriers.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  const removeCourier = (i: number) =>
    set({ couriers: details.couriers.filter((_, idx) => idx !== i) });

  const timeOptions = [
    { value: "asap" as const, label: "⚡ ASAP" },
    { value: "today" as const, label: "Today" },
    { value: "scheduled" as const, label: "📅 Scheduled" },
  ];

  return (
    <>
      {/* Service type */}
      <div className="mb-3.5">
        <label className="text-xs font-semibold mb-1.5 block">Service Type</label>
        <select
          className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13.5px]"
          value={selected}
          onChange={(e) => set({ serviceType: e.target.value })}
        >
          {serviceOptions.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </div>

      {/* Pickup details */}
      <div className="mb-3.5">
        <label className="text-xs font-semibold mb-1.5 block">Pickup Details</label>
        {isParcelService(selected) ? (
          <>
            <label className="text-xs font-semibold mb-1.5 block">
              Parcels to pick up — split items across couriers:
            </label>
            <div className="grid grid-cols-[1fr_80px_auto] gap-1.5 mb-1.5">
              <span className="text-[10px] text-slate font-semibold uppercase tracking-wide px-0.5">
                Courier
              </span>
              <span className="text-[10px] text-slate font-semibold uppercase tracking-wide px-0.5">
                Items
              </span>
              <span />
            </div>
            {details.couriers.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_auto] gap-1.5 mb-1.5">
                <select
                  className="bg-white border border-line rounded-[10px] px-3 py-2 text-[13px] min-w-0"
                  value={c.courier}
                  onChange={(e) => updateCourier(i, { courier: e.target.value })}
                >
                  <option value="">Select courier…</option>
                  {PARCEL_SERVICES.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
                <input
                  className="bg-white border border-line rounded-[10px] px-2 py-2 text-[13px] min-w-0"
                  placeholder="No."
                  value={c.qty}
                  onChange={(e) => updateCourier(i, { qty: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removeCourier(i)}
                  className="text-[12px] text-orange font-semibold px-1"
                  aria-label="Remove courier"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addCourier}
              className="text-[12px] font-semibold text-teal hover:underline"
            >
              + Add another courier
            </button>
          </>
        ) : (
          <>
            <label className="text-xs font-semibold mb-1.5 block">Pickup Location:</label>
            <input
              className={`${INPUT_CLASS} mb-0`}
              placeholder="Enter pickup location"
              value={details.pickupLocation}
              onChange={(e) => set({ pickupLocation: e.target.value })}
            />
          </>
        )}
      </div>

      {/* Delivery details */}
      <div className="mb-3.5">
        <label className="text-xs font-semibold mb-1.5 block">Delivery Details</label>
        <label className="text-xs font-semibold mb-1.5 block">Delivery Area:</label>
        <input
          className={INPUT_CLASS}
          placeholder="Enter delivery area"
          value={details.deliveryArea}
          onChange={(e) => set({ deliveryArea: e.target.value })}
        />
        <label className="text-xs font-semibold mb-1.5 block">
          No. House, Lot, Unit Number:
        </label>
        <input
          className={INPUT_CLASS}
          placeholder="Enter house / lot / unit number"
          value={details.houseNo}
          onChange={(e) => set({ houseNo: e.target.value })}
        />
        <label className="text-xs font-semibold mb-1.5 block">Receiver Name:</label>
        <input
          className={INPUT_CLASS}
          placeholder="Enter receiver name"
          value={details.receiverName}
          onChange={(e) => set({ receiverName: e.target.value })}
        />
        <label className="text-xs font-semibold mb-1.5 block">
          Receiver Phone (Optional):
        </label>
        <input
          className={`${INPUT_CLASS} mb-0`}
          placeholder="Enter receiver phone"
          value={details.receiverPhone}
          onChange={(e) => set({ receiverPhone: e.target.value })}
        />
      </div>

      {/* Items / request details */}
      <div className="mb-3.5">
        <label className="text-xs font-semibold mb-1.5 block">Items / Request Details</label>
        {itemList ? (
          <>
            <div className="grid grid-cols-[1fr_90px_auto] gap-1.5 mb-1.5">
              <span className="text-[10px] text-slate font-semibold uppercase tracking-wide px-0.5">
                Item
              </span>
              <span className="text-[10px] text-slate font-semibold uppercase tracking-wide px-0.5">
                Qty
              </span>
              <span />
            </div>
            {details.items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_90px_auto] gap-1.5 mb-1.5">
                <input
                  className="bg-white border border-line rounded-[10px] px-3 py-2 text-[13px] min-w-0"
                  placeholder="e.g. Rice 5kg"
                  value={it.name}
                  onChange={(e) => updateItem(i, { name: e.target.value })}
                />
                <input
                  className="bg-white border border-line rounded-[10px] px-2 py-2 text-[13px] min-w-0"
                  placeholder="Qty"
                  value={it.qty}
                  onChange={(e) => updateItem(i, { qty: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="text-[12px] text-orange font-semibold px-1"
                  aria-label="Remove item"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addItem}
              className="text-[12px] font-semibold text-teal hover:underline"
            >
              + Add item
            </button>
          </>
        ) : (
          <textarea
            className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13.5px] min-h-[80px]"
            placeholder={
              selected === "Parcel Pickup" || selected === "Document Delivery"
                ? "e.g. Parcel under the name Ahmad, receipt number 88213"
                : "e.g. 2 bags of rice, 1 carton of mineral water"
            }
            value={details.itemsText}
            onChange={(e) => set({ itemsText: e.target.value })}
          />
        )}
      </div>

      {/* Delivery time */}
      <div className="mb-3.5">
        <label className="text-xs font-semibold mb-1.5 block">Delivery Time</label>
        <div className="flex gap-1.5 mb-1.5">
          {timeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set({ deliveryTime: opt.value })}
              className={`flex-1 py-2.5 rounded-[10px] text-[12px] font-semibold border transition-colors ${
                details.deliveryTime === opt.value
                  ? "bg-orange text-white border-orange"
                  : "bg-white text-slate border-line"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {details.deliveryTime === "scheduled" && (
          <input
            className={INPUT_CLASS}
            placeholder="Preferred Time — e.g. 3:00 PM – 4:00 PM"
            value={details.preferredTime}
            onChange={(e) => set({ preferredTime: e.target.value })}
          />
        )}
        <div className="text-[11px] text-slate bg-paper2 rounded-lg px-3 py-2">
          Needed By: <b className="text-ink">{
            details.deliveryTime === "scheduled"
              ? details.preferredTime.trim() || "Scheduled"
              : details.deliveryTime === "today"
              ? "Today"
              : "ASAP"
          }</b>
        </div>
      </div>
    </>
  );
}

export function useRequestDetails(initial: Partial<RequestDetails> = {}) {
  const [details, setDetails] = useState<RequestDetails>({
    ...EMPTY_REQUEST_DETAILS,
    ...initial,
  });
  return { details, setDetails };
}
