"use client";

import { RunnerStatus } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

const CONFIG: Record<RunnerStatus, { emoji: string; className: string }> = {
  available: { emoji: "🟢", className: "bg-[#E4F3EC] text-teal" },
  busy: { emoji: "🟡", className: "bg-[#FDF6E3] text-[#8A6D00]" },
  delivery: { emoji: "🚗", className: "bg-[#FDEFE3] text-orange" },
  offline: { emoji: "🔴", className: "bg-[#EEEEEE] text-slate" },
};

export default function StatusPill({
  status,
  note,
}: {
  status: RunnerStatus;
  note?: string;
}) {
  const { t } = useI18n();
  const c = CONFIG[status];
  return (
    <span
      className={`font-mono text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap h-fit flex-shrink-0 ${c.className}`}
    >
      {c.emoji} {t(`status.${status}`)}
      {note ? ` · ${note}` : ""}
    </span>
  );
}
