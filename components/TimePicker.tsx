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
        <div className="absolute z-20 mt-2 w-full bg-white border border-line rounded-[14px] shadow-[0_20px_40px_-20px_rgba(28,35,33,0.35)] p-4">
          <div className="text-[11px] font-semibold text-slate mb-2">Set the time</div>

          <div className="mb-3">
            <div className="flex justify-between text-[10px] text-slate mb-1">
              <span>Manual (or slide below)</span>
              <span className="font-mono">{hourLabel}</span>
            </div>
            <input
              type="text"
              value={hourLabel}
              onChange={(e) => {
                const m = e.target.value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
                if (m) {
                  const h = parseInt(m[1], 10);
                  const min = parseInt(m[2], 10);
                  if (h >= 1 && h <= 12) setHour(h);
                  if (min >= 0 && min <= 59) setMinute(min);
                  setAmpm(m[3].toUpperCase() as "AM" | "PM");
                }
              }}
              placeholder="8:00 AM"
              className="w-full bg-paper border border-line rounded-[10px] px-3 py-2 text-[12.5px] font-mono"
            />
          </div>

          <div className="mb-3">
            <div className="flex justify-between text-[10px] text-slate mb-1">
              <span>Hour</span>
              <span className="font-mono">{hour}</span>
            </div>
            <input
              type="range"
              min={1}
              max={12}
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              className="w-full accent-[#E85D2C]"
            />
          </div>

          <div className="mb-3">
            <div className="flex justify-between text-[10px] text-slate mb-1">
              <span>Minutes</span>
              <span className="font-mono">{String(minute).padStart(2, "0")}</span>
            </div>
            <input
              type="range"
              min={0}
              max={55}
              step={5}
              value={minute}
              onChange={(e) => setMinute(Number(e.target.value))}
              className="w-full accent-[#E85D2C]"
            />
          </div>

          <div className="flex gap-2 mb-4">
            {(["AM", "PM"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setAmpm(m)}
                className={`flex-1 py-1.5 rounded-full text-[12px] font-semibold border ${
                  ampm === m
                    ? "bg-teal text-white border-teal"
                    : "bg-paper text-slate border-line"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={save}
            className="w-full bg-orange text-white rounded-[10px] py-2.5 text-[12.5px] font-semibold"
          >
            Set {hourLabel}
          </button>
        </div>
      )}
    </div>
  );
}
