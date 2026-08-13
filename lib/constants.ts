export const SERVICE_PRESETS = [
  "Parcel Pickup",
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

// Strip old courier lists still stored in the DB, e.g.
// "Parcel Pickup (JNT / SPX / GDEX)" -> "Parcel Pickup".
export function cleanServiceName(s: string): string {
  return s
    .replace(/\(JNT\s*\/\s*SPX\s*\/\s*GDEX\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// "RM4" not "RM04" / "RM4.00" — whole ringgit without leading or trailing zeros.
export function formatRM(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "RM0";
  const rounded = Math.round(value * 100) / 100;
  const fixed = rounded.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  return `RM${fixed}`;
}

// Normalize Malaysian WhatsApp numbers to +60XXXXXXXXX so wa.me links
// always work. Accepts 0123456789, 012-3456789, 01112345678, +60123456789,
// +601112345678, 60123456789. Handles every Malaysian mobile prefix (010–019)
// at 10 or 11 digits (e.g. 011-1234-5678 is 11 digits).
export function normalizeWhatsApp(input: string): string {
  const raw = (input ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if ((digits.length === 10 || digits.length === 11) && digits.startsWith("0"))
    return `+60${digits.slice(1)}`;
  if ((digits.length === 11 || digits.length === 12) && digits.startsWith("60"))
    return `+${digits}`;
  if ((digits.length === 9 || digits.length === 10) && digits.startsWith("1"))
    return `+60${digits}`;
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
