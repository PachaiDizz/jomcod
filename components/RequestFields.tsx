import { useState } from "react";
import { formatRM } from "@/lib/constants";

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
  price: string;
}

export interface ParcelCourier {
  courier: string;
  qty: string;
}

export interface ExtraService {
  id: string;
  serviceType: string;
  couriers: ParcelCourier[];
  pickupLocation: string;
  items: RequestItem[];
  itemsText: string;
}

export interface RequestDetails {
  serviceType: string;
  couriers: ParcelCourier[];
  pickupLocation: string;
  deliveryArea: string;
  sahabat: string;
  noRumah: string;
  unit: string;
  block: string;
  receiverName: string;
  receiverPhone: string;
  items: RequestItem[];
  itemsText: string;
  extraServices: ExtraService[];
  deliveryTime: "asap" | "today" | "scheduled";
  preferredTime: string;
}

const emptyItem = (): RequestItem => ({ name: "", qty: "", price: "" });

export const EMPTY_REQUEST_DETAILS: RequestDetails = {
  serviceType: "",
  couriers: [{ courier: "", qty: "" }],
  pickupLocation: "",
  deliveryArea: "",
  sahabat: "",
  noRumah: "",
  unit: "",
  block: "",
  receiverName: "",
  receiverPhone: "",
  items: [emptyItem()],
  itemsText: "",
  extraServices: [],
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

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

function buildTakeFromFor(
  serviceType: string,
  couriers: ParcelCourier[],
  pickupLocation: string
): string {
  if (isParcelService(serviceType)) {
    const entries = couriers
      .filter((c) => c.courier.trim())
      .map((c) =>
        c.qty.trim()
          ? `${c.courier.trim()} ×${c.qty.trim()} item${c.qty.trim() === "1" ? "" : "s"}`
          : c.courier.trim()
      );
    return entries.length > 0 ? entries.join(", ") : "Parcel pickup";
  }
  return pickupLocation.trim();
}

export function buildTakeFrom(d: RequestDetails): string {
  const primary = buildTakeFromFor(d.serviceType, d.couriers, d.pickupLocation);
  const extraParts = d.extraServices.map((e) => {
    const t = buildTakeFromFor(e.serviceType, e.couriers, e.pickupLocation);
    return `${titleCaseService(e.serviceType)}: ${t}`;
  });
  const all = [primary, ...extraParts].filter(Boolean);
  return all.length > 0 ? all.join(" · ") : "";
}

export function parseDeliverTo(s: string) {
  const out = {
    deliveryArea: "",
    sahabat: "",
    noRumah: "",
    unit: "",
    block: "",
    receiverName: "",
    receiverPhone: "",
  };
  for (const p of s.split(" · ")) {
    const t = p.trim();
    if (!t) continue;
    const sm = t.match(/^Sahabat\s+(.+)$/i);
    const nm = t.match(/^No R\s+(.+)$/i);
    const um = t.match(/^Unit\s+(.+)$/i);
    const bm = t.match(/^Block\s+(.+)$/i);
    const pm = t.match(/^(.+?)\s*\((.+)\)$/);
    if (sm) out.sahabat = sm[1]!.trim();
    else if (nm) out.noRumah = nm[1]!.trim();
    else if (um) out.unit = um[1]!.trim();
    else if (bm) out.block = bm[1]!.trim();
    else if (pm) {
      out.receiverName = pm[1]!.trim();
      out.receiverPhone = pm[2]!.trim();
    } else out.deliveryArea = t;
  }
  return out;
}

export function buildDeliverTo(d: RequestDetails): string {
  const receiver = d.receiverName.trim();
  const receiverFull = receiver + (d.receiverPhone.trim() ? ` (${d.receiverPhone.trim()})` : "");
  const zone = d.sahabat.trim() ? `Sahabat ${d.sahabat.trim()}` : d.deliveryArea.trim();
  const parts = [
    zone,
    d.noRumah.trim() ? `No R ${d.noRumah.trim()}` : "",
    d.unit.trim() ? `Unit ${d.unit.trim()}` : "",
    d.block.trim() ? `Block ${d.block.trim()}` : "",
    receiverFull,
  ];
  return parts.filter(Boolean).join(" · ");
}

export function neededBy(d: RequestDetails): string {
  if (d.deliveryTime === "scheduled") {
    return d.preferredTime.trim() ? d.preferredTime.trim() : "Scheduled";
  }
  if (d.deliveryTime === "today") return "Today";
  return "ASAP";
}

function titleCaseService(s: string): string {
  return s
    .split(" ")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function itemsToText(items: RequestItem[]): string {
  const filled = items.filter((i) => i.name.trim() && i.qty.trim());
  if (filled.length === 0) return "";
  return filled
    .map((i) => {
      let s = `${i.name.trim()} ×${i.qty.trim()}`;
      if (i.price.trim()) s += ` @ ${formatRM(Number(i.price))}`;
      return s;
    })
    .join(", ");
}

export function buildNotes(d: RequestDetails): string {
  const lines: string[] = [];

  if (isItemListService(d.serviceType)) {
    const items = itemsToText(d.items);
    if (items) lines.push(`Items: ${items}`);
    if (d.itemsText.trim()) lines.push(d.itemsText.trim());
  } else {
    if (d.itemsText.trim()) lines.push(d.itemsText.trim());
  }

  for (const e of d.extraServices) {
    lines.push(`Service: ${titleCaseService(e.serviceType)}`);
    if (isItemListService(e.serviceType)) {
      const items = itemsToText(e.items);
      if (items) lines.push(`Items: ${items}`);
      if (e.itemsText.trim()) lines.push(e.itemsText.trim());
    } else if (e.itemsText.trim()) {
      lines.push(e.itemsText.trim());
    }
  }

  const total = totalCost(d);
  if (total > 0) lines.push(`Total: ${formatRM(total)}`);

  lines.push(`Needed By: ${neededBy(d)}`);
  return lines.join("\n");
}

export function totalItemCount(d: RequestDetails): number {
  let sum = d.items.reduce((s, i) => s + (parseInt(i.qty, 10) || 0), 0);
  for (const e of d.extraServices) {
    sum += e.items.reduce((s, i) => s + (parseInt(i.qty, 10) || 0), 0);
  }
  return sum;
}

// Auto-sum calculator: qty × price per line, across every service.
export function totalCost(d: RequestDetails): number {
  let total = 0;
  const lines: RequestItem[] = [
    ...d.items,
    ...d.extraServices.flatMap((e) => e.items),
  ];
  for (const i of lines) {
    const qty = parseFloat(i.qty) || 0;
    const price = parseFloat(i.price) || 0;
    total += qty * price;
  }
  return Math.round(total * 100) / 100;
}

const INPUT_CLASS =
  "w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13.5px] mb-1.5";

function ItemRows({
  items,
  onChange,
}: {
  items: RequestItem[];
  onChange: (items: RequestItem[]) => void;
}) {
  const update = (i: number, patch: Partial<RequestItem>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, emptyItem()]);

  const subtotal = items.reduce((sum, i) => {
    const qty = parseFloat(i.qty) || 0;
    const price = parseFloat(i.price) || 0;
    return sum + qty * price;
  }, 0);

  return (
    <div className="rounded-[12px] border border-line bg-white overflow-hidden">
      <div className="grid grid-cols-[1fr_58px_78px_auto] gap-1.5 px-3 pt-2.5 pb-1">
        <span className="text-[10px] text-slate font-semibold uppercase tracking-wide">Item</span>
        <span className="text-[10px] text-slate font-semibold uppercase tracking-wide">Qty</span>
        <span className="text-[10px] text-slate font-semibold uppercase tracking-wide">RM</span>
        <span />
      </div>
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[1fr_58px_78px_auto] gap-1.5 px-3 py-1">
          <input
            className="bg-paper2 border border-line rounded-[8px] px-2.5 py-2 text-[13px] min-w-0"
            placeholder="e.g. Rice 5kg"
            value={it.name}
            onChange={(e) => update(i, { name: e.target.value })}
          />
          <input
            inputMode="numeric"
            className="bg-paper2 border border-line rounded-[8px] px-2 py-2 text-[13px] min-w-0 text-center"
            placeholder="1"
            value={it.qty}
            onChange={(e) => update(i, { qty: e.target.value })}
          />
          <input
            inputMode="decimal"
            className="bg-paper2 border border-line rounded-[8px] px-2 py-2 text-[13px] min-w-0 text-center"
            placeholder="0.00"
            value={it.price}
            onChange={(e) => update(i, { price: e.target.value })}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-[12px] text-orange font-semibold px-1"
            aria-label="Remove item"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-paper2 border-t border-line">
        <button
          type="button"
          onClick={add}
          className="text-[12px] font-semibold text-teal hover:underline"
        >
          + Add item
        </button>
        <div className="text-[12px] text-slate">
          Subtotal: <b className="text-ink font-mono">{formatRM(subtotal)}</b>
        </div>
      </div>
    </div>
  );
}

function CourierRows({
  couriers,
  onChange,
}: {
  couriers: ParcelCourier[];
  onChange: (couriers: ParcelCourier[]) => void;
}) {
  const update = (i: number, patch: Partial<ParcelCourier>) =>
    onChange(couriers.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const remove = (i: number) => onChange(couriers.filter((_, idx) => idx !== i));
  const add = () => onChange([...couriers, { courier: "", qty: "" }]);

  return (
    <>
      <div className="grid grid-cols-[1fr_80px_auto] gap-1.5 mb-1.5">
        <span className="text-[10px] text-slate font-semibold uppercase tracking-wide px-0.5">
          Courier
        </span>
        <span className="text-[10px] text-slate font-semibold uppercase tracking-wide px-0.5">
          Items
        </span>
        <span />
      </div>
      {couriers.map((c, i) => (
        <div key={i} className="grid grid-cols-[1fr_80px_auto] gap-1.5 mb-1.5">
          <select
            className="bg-white border border-line rounded-[10px] px-3 py-2 text-[13px] min-w-0"
            value={c.courier}
            onChange={(e) => update(i, { courier: e.target.value })}
          >
            <option value="">Select courier…</option>
            {PARCEL_SERVICES.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
          <input
            inputMode="numeric"
            className="bg-white border border-line rounded-[10px] px-2 py-2 text-[13px] min-w-0 text-center"
            placeholder="No."
            value={c.qty}
            onChange={(e) => update(i, { qty: e.target.value })}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-[12px] text-orange font-semibold px-1"
            aria-label="Remove courier"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-[12px] font-semibold text-teal hover:underline"
      >
        + Add another courier
      </button>
    </>
  );
}

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

  const updateExtra = (id: string, patch: Partial<ExtraService>) =>
    set({
      extraServices: details.extraServices.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  const removeExtra = (id: string) =>
    set({ extraServices: details.extraServices.filter((e) => e.id !== id) });

  const timeOptions = [
    { value: "asap" as const, label: "⚡ ASAP" },
    { value: "today" as const, label: "Today" },
    { value: "scheduled" as const, label: "📅 Scheduled" },
  ];

  const grandTotal = totalCost(details);

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
          <CourierRows
            couriers={details.couriers}
            onChange={(couriers) => set({ couriers })}
          />
        ) : (
          <>
            <label className="text-xs font-semibold mb-1.5 block">Pickup Location:</label>
            <input
              className={INPUT_CLASS}
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
          placeholder="e.g. Felda Wilayah Sahabat"
          value={details.deliveryArea}
          onChange={(e) => set({ deliveryArea: e.target.value })}
        />
        <label className="text-xs font-semibold mb-1.5 block">Sahabat:</label>
        <input
          className={INPUT_CLASS}
          placeholder="e.g. 05"
          value={details.sahabat}
          onChange={(e) => set({ sahabat: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold mb-1.5 block">No. Rumah (No R):</label>
            <input
              className={INPUT_CLASS}
              placeholder="e.g. 203"
              value={details.noRumah}
              onChange={(e) => set({ noRumah: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1.5 block">Unit Number:</label>
            <input
              className={INPUT_CLASS}
              placeholder="e.g. 3A"
              value={details.unit}
              onChange={(e) => set({ unit: e.target.value })}
            />
          </div>
        </div>
        <label className="text-xs font-semibold mb-1.5 block">Block:</label>
        <input
          className={INPUT_CLASS}
          placeholder="e.g. 04"
          value={details.block}
          onChange={(e) => set({ block: e.target.value })}
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
          <ItemRows items={details.items} onChange={(items) => set({ items })} />
        ) : (
          <textarea
            className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13.5px] min-h-[80px]"
            placeholder={
              isParcelService(selected)
                ? "e.g. Parcel under the name Ahmad, receipt number 88213"
                : "e.g. 2 bags of rice, 1 carton of mineral water"
            }
            value={details.itemsText}
            onChange={(e) => set({ itemsText: e.target.value })}
          />
        )}
      </div>

      {/* Extra services — use the same runner for more jobs */}
      {details.extraServices.map((e, idx) => (
        <div
          key={e.id}
          className="rounded-[12px] border-[1.5px] border-orange/30 bg-[#FDF3EE]/50 p-3 mb-3.5"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-[12px] font-bold text-orange">
              + {titleCaseService(e.serviceType || "Extra service")}
            </div>
            <button
              type="button"
              onClick={() => removeExtra(e.id)}
              className="text-[11px] text-orange font-semibold"
            >
              Remove
            </button>
          </div>
          <label className="text-xs font-semibold mb-1.5 block">Service Type:</label>
          <select
            className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13.5px] mb-2.5"
            value={e.serviceType}
            onChange={(ev) =>
              updateExtra(e.id, {
                serviceType: ev.target.value,
                items: [emptyItem()],
              })
            }
          >
            {serviceOptions.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
          {isParcelService(e.serviceType) ? (
            <CourierRows
              couriers={e.couriers}
              onChange={(couriers) => updateExtra(e.id, { couriers })}
            />
          ) : (
            <>
              <label className="text-xs font-semibold mb-1.5 block">Pickup Location:</label>
              <input
                className={INPUT_CLASS}
                placeholder="Enter pickup location"
                value={e.pickupLocation}
                onChange={(ev) => updateExtra(e.id, { pickupLocation: ev.target.value })}
              />
            </>
          )}
          {isItemListService(e.serviceType) ? (
            <div className="mt-2.5">
              <ItemRows
                items={e.items}
                onChange={(items) => updateExtra(e.id, { items })}
              />
            </div>
          ) : (
            <textarea
              className="w-full bg-white border border-line rounded-[10px] px-3 py-2.5 text-[13.5px] min-h-[70px] mt-2.5"
              placeholder="Details for this extra service"
              value={e.itemsText}
              onChange={(ev) => updateExtra(e.id, { itemsText: ev.target.value })}
            />
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          set({
            extraServices: [
              ...details.extraServices,
              {
                id: newId(),
                serviceType: serviceOptions[0] ?? "Grocery Run",
                couriers: [{ courier: "", qty: "" }],
                pickupLocation: "",
                items: [emptyItem()],
                itemsText: "",
              },
            ],
          })
        }
        className="w-full mb-3.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold text-orange bg-[#FDF3EE] border border-dashed border-orange/40 hover:bg-orange/10 transition-colors"
      >
        ＋ Add another service for {serviceOptions[0] ? "this runner" : "the same runner"}
      </button>

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
          Needed By: <b className="text-ink">{neededBy(details)}</b>
        </div>
      </div>

      {/* Grand total calculator */}
      {grandTotal > 0 && (
        <div className="rounded-[12px] border-[1.5px] border-teal/30 bg-[#E4F3EC] px-3.5 py-3 mb-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[12px] font-semibold text-teal">Estimated total</div>
            <div className="font-mono font-bold text-[17px] text-teal">{formatRM(grandTotal)}</div>
          </div>
          <div className="text-[10.5px] text-slate mt-0.5">
            Auto-calculated from item quantities and prices — both sides see this.
          </div>
        </div>
      )}
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
