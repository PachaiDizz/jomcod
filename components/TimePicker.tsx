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

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

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

  const bumpHour = (d: number) => {
    let h = hour + d;
    if (h > 12) h = 1;
    if (h < 1) h = 12;
    setHour(h);
  };
  const bumpMinute = (d: number) => setMinute((m) => clamp(m + d, 0, 59));

  return (
    <div className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left bg-white border border-line rounded-[10px] px-3 py-2.5 text-[12.5px] flex items-center justify-between gap-2"
      >
        <span className={value ? "truncate" : "text-slate truncate"}>{value || placeholder}</span>
        <span className="text-[11px] text-slate">🕐</span>
      </button>

      {open && (
        <div className="fixed inset-x-0 bottom-0 z-50 sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:mt-1.5 sm:w-[300px] sm:z-20 bg-white border border-line rounded-t-2xl sm:rounded-xl shadow-[0_-10px_40px_-20px_rgba(28,35,33,0.4),0_20px_40px_-20px_rgba(28,35,33,0.35)] sm:shadow-[0_20px_40px_-20px_rgba(28,35,33,0.35)] p-3">
          <div className="flex items-center justify-between mb-2.5">
            <div className="font-mono font-bold text-[17px]">{hourLabel}</div>
            <button
              type="button"
              onClick={save}
              className="bg-orange text-white rounded-[8px] px-4 py-1.5 text-[11.5px] font-semibold"
            >
              Set
            </button>
          </div>

          {/* AM / PM */}
          <div className="flex gap-1 mb-3">
            {(["AM", "PM"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setAmpm(m)}
                className={`flex-1 py-2 rounded-[10px] text-[11px] font-semibold border touch-manipulation ${
                  ampm === m
                    ? "bg-teal text-white border-teal"
                    : "bg-paper text-slate border-line"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Hour row */}
          <div className="flex items-center gap-2 mb-2.5">
            <button
              type="button"
              aria-label="Hour down"
              onClick={() => bumpHour(-1)}
              className="w-9 h-9 rounded-[10px] bg-paper border border-line text-[16px] font-semibold flex-shrink-0 touch-manipulation active:bg-line"
            >
              −
            </button>
            <div className="flex-1">
              <div className="text-[9px] text-slate font-semibold uppercase tracking-wide text-center mb-0.5">
                Hour
              </div>
              <input
                type="range"
                min={1}
                max={12}
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
                className="w-full h-2 accent-[#E85D2C]"
              />
            </div>
            <button
              type="button"
              aria-label="Hour up"
              onClick={() => bumpHour(1)}
              className="w-9 h-9 rounded-[10px] bg-paper border border-line text-[16px] font-semibold flex-shrink-0 touch-manipulation active:bg-line"
            >
              +
            </button>
          </div>

          {/* Minute row */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Minute down"
              onClick={() => bumpMinute(-5)}
              className="w-9 h-9 rounded-[10px] bg-paper border border-line text-[16px] font-semibold flex-shrink-0 touch-manipulation active:bg-line"
            >
              −
            </button>
            <div className="flex-1">
              <div className="text-[9px] text-slate font-semibold uppercase tracking-wide text-center mb-0.5">
                Minute
              </div>
              <input
                type="range"
                min={0}
                max={55}
                step={5}
                value={minute}
                onChange={(e) => setMinute(Number(e.target.value))}
                className="w-full h-2 accent-[#E85D2C]"
              />
            </div>
            <button
              type="button"
              aria-label="Minute up"
              onClick={() => bumpMinute(5)}
              className="w-9 h-9 rounded-[10px] bg-paper border border-line text-[16px] font-semibold flex-shrink-0 touch-manipulation active:bg-line"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
