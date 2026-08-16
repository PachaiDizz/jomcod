"use client";

import { useEffect, useRef, useState } from "react";
import { OTHER_SERVICE, SERVICE_CATEGORIES, categoryLabelKey, serviceNameKey } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";

// Compact service dropdown. On mobile the native <select> opens a huge,
// un-dismissible picker, so this renders a small scrollable list instead.
// Closes on outside tap or on selection; keeps the chosen English name in
// state while showing the translated label. When `options` is provided (a
// runner's custom services), it shows that flat list instead of the presets.
export default function ServicePicker({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  options?: string[];
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const display = value ? t(serviceNameKey(value)) : placeholder;

  const filterList = (names: string[]) => {
    const qq = q.trim().toLowerCase();
    if (!qq) return names;
    return names.filter((n) => t(serviceNameKey(n)).toLowerCase().includes(qq));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full bg-white border border-line rounded-[10px] px-3 py-2 text-[12.5px] text-left flex items-center justify-between gap-2"
      >
        <span className={value ? "text-ink" : "text-slate"}>{display}</span>
        <span className={`text-slate text-[10px] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 bg-white border border-line rounded-[10px] shadow-lg max-h-[180px] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-line px-2 py-1.5">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-paper2 border border-line rounded-md px-2 py-1 text-[11.5px]"
            />
          </div>
          {options ? (
            filterList(options).map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                  setQ("");
                }}
                className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-paper2 transition-colors ${
                  value.toLowerCase() === name.toLowerCase()
                    ? "bg-[#FDF3EE] text-orange font-semibold"
                    : "text-ink"
                }`}
              >
                {t(serviceNameKey(name))}
              </button>
            ))
          ) : (
            <>
              {SERVICE_CATEGORIES.map((cat) => {
                const list = filterList(cat.services);
                if (list.length === 0) return null;
                return (
                  <div key={cat.label}>
                    <div className="px-3 pt-1.5 pb-0.5 text-[9px] font-bold uppercase tracking-wide text-slate">
                      {cat.emoji} {t(categoryLabelKey(cat.label))}
                    </div>
                    {list.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          onChange(name);
                          setOpen(false);
                          setQ("");
                        }}
                        className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-paper2 transition-colors ${
                          value.toLowerCase() === name.toLowerCase()
                            ? "bg-[#FDF3EE] text-orange font-semibold"
                            : "text-ink"
                        }`}
                      >
                        {t(serviceNameKey(name))}
                      </button>
                    ))}
                  </div>
                );
              })}
              <div className="border-t border-line mt-1">
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                    setQ("");
                  }}
                  className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-paper2 transition-colors ${
                    value === OTHER_SERVICE ? "bg-[#FDF3EE] text-orange font-semibold" : "text-ink"
                  }`}
                >
                  {t(serviceNameKey(OTHER_SERVICE))}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
