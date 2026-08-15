// Parsing + display helpers for job route data (takeFrom / deliverTo).
// Used so every card (broadcast board, current job, recent jobs, history,
// job detail) renders the same clean, separated information.

export interface ParsedDeliverTo {
  deliveryArea: string;
  sahabat: string;
  noRumah: string;
  unit: string;
  block: string;
  receiverName: string;
  receiverPhone: string;
}

// Splits a `deliver_to` value built by buildDeliverTo():
//   "Sahabat 05 · No R 203 · Unit 3A · Block 04 · Ahmad (0123...)"
// Order-aware: the first part is the zone, the last part is the receiver
// (the receiver is always appended last), everything in between is address.
export function parseDeliverTo(s: string): ParsedDeliverTo {
  const out: ParsedDeliverTo = {
    deliveryArea: "",
    sahabat: "",
    noRumah: "",
    unit: "",
    block: "",
    receiverName: "",
    receiverPhone: "",
  };
  const parts = s
    .split(" · ")
    .map((p) => p.trim())
    .filter(Boolean);
  parts.forEach((t, idx) => {
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
    } else if (idx === parts.length - 1) {
      // Last part that isn't an address piece = the receiver's name.
      out.receiverName = t;
    } else {
      out.deliveryArea = t;
    }
  });
  return out;
}

// "J&T ×1 item" → "J&T: 1 item"; leaves plain locations untouched.
function formatTakeFromPart(part: string): string {
  const t = part.trim();
  const m = t.match(/^(.+?)\s*[×x*]\s*(\d+(?:\.\d+)?)\s*items?$/i);
  if (m) {
    const n = m[2]!;
    return `${m[1]!.trim()}: ${n} item${n === "1" ? "" : "s"}`;
  }
  return t;
}

// Take a `take_from` value and turn it into clean, one-per-line strings:
//   "J&T ×1 item, SPX Express ×3 items" → ["J&T: 1 item", "SPX Express: 3 items"]
//   "J&T Sahabat"                      → ["J&T Sahabat"]
export function formatTakeFromLines(takeFrom: string): string[] {
  const lines: string[] = [];
  for (const part of takeFrom.split(" · ")) {
    const t = part.trim();
    if (!t) continue;
    for (const sub of t.split(", ")) {
      const line = formatTakeFromPart(sub);
      if (line) lines.push(line);
    }
  }
  return lines;
}

export interface FormattedDelivery {
  address: string;
  receiverName: string;
  receiverPhone: string;
}

// Clean delivery display: a readable address line + the receiver's name/phone
// pulled from the correct fields (never the block number or house number).
export function formatDelivery(deliverTo: string): FormattedDelivery {
  const p = parseDeliverTo(deliverTo);
  const address = [
    p.sahabat ? `Sahabat ${p.sahabat}` : p.deliveryArea,
    p.noRumah ? `No R ${p.noRumah}` : "",
    p.unit ? `Unit ${p.unit}` : "",
    p.block ? `Block ${p.block}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  return {
    address: address || deliverTo,
    receiverName: p.receiverName,
    receiverPhone: p.receiverPhone,
  };
}
