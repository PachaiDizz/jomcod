import { formatRM } from "./constants";
import { PricingModel, Runner } from "./types";

// Stand-in for the future database. No fake data — the app now reads real
// Supabase records. `getRunners()` etc. stay here so the UI renders empty
// states until the profiles table is wired up in a later step.

export const runners: Runner[] = [];

export function getRunners(): Runner[] {
  return runners;
}

export function getRunnerById(id: string): Runner | undefined {
  return runners.find((r) => r.id === id);
}

export function pricingLabel(model: PricingModel): string {
  if (model === "flat_rate") return "flat rate";
  if (model === "per_item") return "per item";
  return "custom";
}

export function pricingDisplay(runner: Runner) {
  const first = runner.services[0];
  if (!first) return "—";
  if (first.pricing.model === "flat_rate") return `${formatRM(first.pricing.price)}/trip`;
  if (first.pricing.model === "per_item") return `${formatRM(first.pricing.price)}/item`;
  return first.pricing.description ?? "custom";
}
