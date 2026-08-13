import { RunnerStatus } from "@/lib/types";

const CONFIG: Record<RunnerStatus, { label: string; emoji: string; className: string }> = {
  available: { label: "Available", emoji: "🟢", className: "bg-[#E4F3EC] text-teal" },
  busy: { label: "Busy", emoji: "🟡", className: "bg-[#FDF6E3] text-[#8A6D00]" },
  delivery: { label: "On delivery", emoji: "🚗", className: "bg-[#FDEFE3] text-orange" },
  offline: { label: "Offline", emoji: "🔴", className: "bg-[#EEEEEE] text-slate" },
};

export default function StatusPill({
  status,
  note,
}: {
  status: RunnerStatus;
  note?: string;
}) {
  const c = CONFIG[status];
  return (
    <span
      className={`font-mono text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap h-fit flex-shrink-0 ${c.className}`}
    >
      {c.emoji} {c.label}
      {note ? ` · ${note}` : ""}
    </span>
  );
}
