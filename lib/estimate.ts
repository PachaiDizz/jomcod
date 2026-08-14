import { cleanServiceName, formatRM } from "./constants";
import type { Service } from "./types";

// Count items from a job's notes ("Items: Rice ×2, Milk ×1") plus any parcel
// courier quantities embedded in takeFrom ("J&T ×3 items, SPX ×2 items").
export function countJobItems(notes: string, takeFrom: string): number {
  let count = 0;
  for (const line of notes.split("\n")) {
    const im = line.match(/^Items:\s*(.*)$/i);
    if (!im) continue;
    for (const part of im[1]!.split(",")) {
      const pm = part.trim().match(/[×x*]\s*([\d.]+)/);
      if (pm) count += parseFloat(pm[1]!) || 0;
      else if (part.trim()) count += 1;
    }
  }
  // Parcel couriers: "J&T ×3 items, SPX ×2 items" → 5 parcels.
  for (const m of takeFrom.matchAll(/×\s*([\d.]+)/g)) {
    count += parseFloat(m[1]!) || 0;
  }
  return count;
}

// Estimate the total for a broadcast job using the RUNNER's own services once
// they've claimed it: per_item → item count × price, flat_rate → flat fee,
// custom → can't auto-calc (null). Returns the same "Total: RM…" string the
// direct-request calculator produces.
export function estimateJobTotal(
  jobServiceType: string,
  notes: string,
  services: Service[],
  takeFrom = ""
): string | null {
  const primaryService = jobServiceType.split(" + ")[0].toLowerCase();
  const svc = services.find(
    (s) => cleanServiceName(s.name).toLowerCase() === primaryService
  );
  if (!svc || svc.pricing.model === "custom" || typeof svc.pricing.price !== "number") {
    return null;
  }
  if (svc.pricing.model === "flat_rate") return formatRM(svc.pricing.price);
  const count = countJobItems(notes, takeFrom);
  if (count <= 0) return null;
  return formatRM(count * svc.pricing.price);
}
