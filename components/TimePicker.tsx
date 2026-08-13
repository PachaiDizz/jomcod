"use client";

import { useEffect, useState } from "react";

function parseTime(value: string): { hour: number; minute: number; ampm: "AM" | "PM" } {
  const match = value?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    return {
      hour: parseInt(match[1], 10),
      minute: parseInt(match[2], 10),
      ampm: match[3].toUpperCase() as "AM" | "PM",
    };
  }
  return { hour: 8, minute: 0, ampm: "AM" };
}

export default function TimePicker({
  value,
  onChange,
  placeholder = "Set a time",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  const [ampm, setAmpm] = useState<"AM" | "PM">("AM");

  useEffect(() => {
    if (open) {
      const t = parseTime(value);
      setHour(t.hour);
      setMinute(t.minute);
      setAmpm(t.ampm);
    }
  }, [open, value]);

  const hourLabel = `${hour}:${String(minute).padStart(2, "0")} ${ampm}`;

  const save = () => {
    onChange(hourLabel);
    setOpen(false);
  };

  return (
    <div className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left bg-white border border-line rounded-[10px] px-3 py-2.5 text-[12.5px] flex items-center justify-between gap-2"
      >
        <span className={value ? "" : "text-slate"}>{value || placeholder}</span>
        <span className="text-[11px] text-slate">🕐</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full bg-white border border-line rounded-xl shadow-[0_20px_40px_-20px_rgba(28,35,33,0.35)] p-2.5">
          <div className="flex gap-1 mb-1.5">
            {(["AM", "PM"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setAmpm(m)}
                className={`flex-1 py-0.5 rounded-full text-[10.5px] font-semibold border ${
                  ampm === m
                    ? "bg-teal text-white border-teal"
                    : "bg-paper text-slate border-line"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate">
            <span className="w-11">{hourLabel}</span>
            <div className="flex-1">
              <input
                type="range"
                min={1}
                max={12}
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
                className="w-full accent-[#E85D2C] h-1 mb-1"
              />
              <input
                type="range"
                min={0}
                max={55}
                step={5}
                value={minute}
                onChange={(e) => setMinute(Number(e.target.value))}
                className="w-full accent-[#E85D2C] h-1"
              />
            </div>
            <button
              type="button"
              onClick={save}
              className="shrink-0 bg-orange text-white rounded-[8px] px-2.5 py-1.5 text-[11px] font-semibold"
            >
              Set
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
