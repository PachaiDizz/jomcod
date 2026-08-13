export const SERVICE_PRESETS = [
  "Parcel Pickup (JNT / SPX / GDEX)",
  "Grocery Run",
  "Buy Groceries For Me",
  "Food Takeaway Pickup",
  "Pay Bills (Toll / Water / Electric)",
  "Top-Up / Reload Card",
  "Pharmacy Run",
  "Documents Delivery",
  "Drop-Off Parcel",
  "Shop Errand",
  "Queue / Collect Number",
  "Petrol Station Run",
  "Laundry Drop-Off / Pickup",
  "ATM / Banking Errand",
  "Other Errand",
];

export const OTHER_SERVICE = "Other (Write It Myself)";

export const AREA_OPTIONS = ["Felda Desa Kencana", "Felda Wilayah Sahabat"];

export function titleCase(s: string): string {
  return s
    .split(" ")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// Normalize Malaysian WhatsApp numbers to +60XXXXXXXXX so wa.me links
// always work. Accepts 0123456789, 012-3456789, +60123456789, 60123456789.
export function normalizeWhatsApp(input: string): string {
  const raw = (input ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) return `+60${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith("60")) return `+${digits}`;
  if ((digits.length === 9 || digits.length === 10) && digits.startsWith("1")) return `+60${digits}`;
  return raw;
}

export function isValidWhatsApp(input: string): boolean {
  return /^\+60\d{9,10}$/.test(normalizeWhatsApp(input));
}

// Build a wa.me link that tolerates any stored format (old rows may have
// dashes/spaces). Returns null when there's nothing usable.
export function waLink(number: string | null | undefined): string | null {
  if (!number) return null;
  const digits = normalizeWhatsApp(number).replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}
