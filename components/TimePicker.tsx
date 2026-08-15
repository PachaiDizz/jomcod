"use client";

import { useEffect, useRef, useState } from "react";

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

const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 00, 05, …, 55

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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      const t = parseTime(value);
      setHour(t.hour);
      setMinute(t.minute);
      setAmpm(t.ampm);
    }
  }, [open, value]);

  // Close when tapping outside, scrolling, or resizing — keeps the popover
  // compact and never clipped.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (popRef.current?.contains(target) || btnRef.current?.contains(target)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const hourLabel = `${hour}:${String(minute).padStart(2, "0")} ${ampm}`;

  // Include the current minute even when it isn't a 5-min step (e.g. a value
  // typed as "8:07 AM"), so the select always shows what's actually saved.
  const minuteOptions = Array.from(new Set([...MINUTES, minute])).sort((a, b) => a - b);

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

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = btnRef.current?.getBoundingClientRect();
    const width = 280;
    const top = (rect?.bottom ?? 0) + 8;
    const maxLeft = Math.max(16, window.innerWidth - width - 16);
    const left = Math.min(Math.max(rect?.left ?? 16, 16), maxLeft);
    setPos({ top, left });
    setOpen(true);
  };

  return (
    <div className="relative flex-1 min-w-0">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="w-full min-w-0 text-left bg-white border border-line rounded-[10px] px-3 py-2.5 text-[12.5px] flex items-center justify-between gap-2"
      >
        <span className={value ? "truncate" : "text-slate truncate"}>{value || placeholder}</span>
        <span className="text-[11px] text-slate flex-shrink-0">🕐</span>
      </button>

      {open && pos && (
        <div
          ref={popRef}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 w-[280px] max-w-[calc(100vw-32px)] bg-white border border-line rounded-xl shadow-[0_20px_40px_-16px_rgba(28,35,33,0.4)] p-3"
        >
          {/* Compact select-based picker — mobile */}
          <div className="md:hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="font-mono font-bold text-[15px]">{hourLabel}</div>
              <button
                type="button"
                onClick={save}
                className="bg-orange text-white rounded-[8px] px-3 py-1 text-[11px] font-semibold"
              >
                Set
              </button>
            </div>
            <div className="flex items-stretch gap-1.5">
              <label className="flex-1 min-w-0 block">
                <span className="block text-[9px] text-slate font-semibold uppercase tracking-wide text-center mb-0.5">
                  Hour
                </span>
                <select
                  value={hour}
                  onChange={(e) => setHour(Number(e.target.value))}
                  className="w-full min-w-0 bg-paper border border-line rounded-[10px] px-2 py-2 text-[13px] font-semibold text-ink focus:border-teal focus:outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex-1 min-w-0 block">
                <span className="block text-[9px] text-slate font-semibold uppercase tracking-wide text-center mb-0.5">
                  Min
                </span>
                <select
                  value={minute}
                  onChange={(e) => setMinute(Number(e.target.value))}
                  className="w-full min-w-0 bg-paper border border-line rounded-[10px] px-2 py-2 text-[13px] font-semibold text-ink focus:border-teal focus:outline-none"
                >
                  {minuteOptions.map((m) => (
                    <option key={m} value={m}>
                      {String(m).padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col gap-1">
                {(["AM", "PM"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setAmpm(m)}
                    className={`flex-1 min-w-0 px-2.5 rounded-[8px] text-[11px] font-semibold border touch-manipulation ${
                      ampm === m
                        ? "bg-teal text-white border-teal"
                        : "bg-paper text-slate border-line"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Wheel-style picker — desktop */}
          <div className="hidden md:block">
            <div className="flex items-center justify-between mb-2">
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
            <div className="flex gap-1 mb-2.5">
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
        </div>
      )}
    </div>
  );
}
