import { cleanServiceName, formatRM } from "./constants";
import type { Service } from "./types";

// Parse the item list a runner actually needs to buy/pick up from a job's
// notes ("Items: Rice ×2, Milk ×1") and return the count per item.
export interface ParsedJobItem {
  name: string;
  qty: string;
}

export function parseJobItems(notes: string): ParsedJobItem[] {
  const out: ParsedJobItem[] = [];
  for (const line of notes.split("\n")) {
    const im = line.match(/^Items:\s*(.*)$/i);
    if (!im) continue;
    for (const part of im[1]!.split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const pm = trimmed.match(/^(.*?)\s*[×x*]\s*([\d.]+)/i);
      if (pm) out.push({ name: pm[1]!.trim(), qty: pm[2]!.trim() });
      else out.push({ name: trimmed, qty: "" });
    }
  }
  return out;
}

// Estimate the total for a broadcast job using the RUNNER's own services once
// they've claimed it: per_item → item count × price, flat_rate → flat fee,
// custom → can't auto-calc (null). Returns the same "Total: RM…" string the
// direct-request calculator produces.
export function estimateJobTotal(jobServiceType: string, notes: string, services: Service[]): string | null {
  const primaryService = jobServiceType.split(" + ")[0].toLowerCase();
  const svc = services.find(
    (s) => cleanServiceName(s.name).toLowerCase() === primaryService
  );
  if (!svc || svc.pricing.model === "custom" || typeof svc.pricing.price !== "number") {
    return null;
  }
  if (svc.pricing.model === "flat_rate") return formatRM(svc.pricing.price);
  const count = parseJobItems(notes).reduce(
    (sum, it) => sum + (parseInt(it.qty, 10) || 0),
    0
  );
  if (count <= 0) return null;
  return formatRM(count * svc.pricing.price);
}
