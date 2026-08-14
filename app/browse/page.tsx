"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PhoneFrame from "@/components/PhoneFrame";
import RunnerCard from "@/components/RunnerCard";
import RoleBadge from "@/components/RoleBadge";
import LoadingState from "@/components/LoadingState";
import { fetchRunners, refreshAvailability } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import type { Runner } from "@/lib/types";

const minPriceFor = (r: Runner): number | null => {
  const prices = r.services
    .map((s) => s.pricing.price)
    .filter((p): p is number => typeof p === "number");
  return prices.length ? Math.min(...prices) : null;
};

export default function BrowsePage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "available">("all");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [priceLimit, setPriceLimit] = useState<number | null>(null);
  const [area, setArea] = useState("");
  const [role, setRole] = useState("");
  const [runners, setRunners] = useState<Runner[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        setArea(data.user?.user_metadata?.area ?? "");
        setRole((data.user?.user_metadata?.role as string) ?? "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      // Auto-offline stale "available" runners before showing the list.
      await refreshAvailability();
      const list = await fetchRunners();
      setRunners(list);
      setLoaded(true);
    })();
  }, []);

  const allServices = useMemo(
    () => Array.from(new Set(runners.flatMap((r) => r.services.map((s) => s.name)))).sort(),
    [runners]
  );
  const allAreas = useMemo(
    () => Array.from(new Set(runners.map((r) => r.area).filter(Boolean))).sort(),
    [runners]
  );
  const maxPrice = useMemo(() => {
    const vals = runners.map(minPriceFor).filter((p): p is number => p !== null);
    return vals.length ? Math.max(...vals) : 100;
  }, [runners]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return runners.filter((r) => {
      if (statusFilter === "available" && r.status !== "available") return false;
      if (selectedServices.length > 0 && !r.services.some((s) => selectedServices.includes(s.name)))
        return false;
      if (selectedAreas.length > 0 && !selectedAreas.includes(r.area)) return false;
      if (priceLimit !== null && priceLimit < maxPrice) {
        const p = minPriceFor(r);
        if (p === null || p > priceLimit) return false;
      }
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.area.toLowerCase().includes(q) ||
        r.services.some((s) => s.name.toLowerCase().includes(q))
      );
    });
  }, [runners, query, statusFilter, selectedServices, selectedAreas, priceLimit, maxPrice]);

  const availableCount = runners.filter((r) => r.status === "available").length;
  const areaLabel = area || "your area";
  const activeFilterCount =
    (selectedServices.length > 0 ? 1 : 0) +
    (selectedAreas.length > 0 ? 1 : 0) +
    (priceLimit !== null && priceLimit < maxPrice ? 1 : 0);

  const clearFilters = () => {
    setSelectedServices([]);
    setSelectedAreas([]);
    setPriceLimit(null);
    setStatusFilter("all");
    setQuery("");
  };

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) =>
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const checkbox = (checked: boolean) =>
    `w-[15px] h-[15px] rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
      checked ? "bg-teal border-teal" : "bg-white border-line"
    }`;

  return (
    <PhoneFrame>
      <div className="mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-[22px] md:text-[30px] font-bold font-display">Find a runner</div>
          <RoleBadge role={role} />
        </div>
        <div className="text-[13px] text-slate mt-0.5">
          Nearby neighbours offering their time in {areaLabel}.
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="bg-white border border-line rounded-[12px] p-3 text-center">
          <div className="font-mono font-semibold text-[18px] md:text-[22px]">{runners.length}</div>
          <div className="text-[9.5px] md:text-[10px] text-slate uppercase tracking-wide mt-0.5">
            Runners
          </div>
        </div>
        <div className="bg-white border border-line rounded-[12px] p-3 text-center">
          <div className="font-mono font-semibold text-[18px] md:text-[22px] text-teal">
            {availableCount}
          </div>
          <div className="text-[9.5px] md:text-[10px] text-slate uppercase tracking-wide mt-0.5">
            Available now
          </div>
        </div>
        <div className="bg-white border border-line rounded-[12px] p-3 text-center">
          <div className="font-mono font-semibold text-[18px] md:text-[22px] text-orange">
            {runners.filter((r) => r.services.length > 0).length}
          </div>
          <div className="text-[9.5px] md:text-[10px] text-slate uppercase tracking-wide mt-0.5">
            Have pricing
          </div>
        </div>
      </div>

      <div className="md:grid md:grid-cols-[260px_1fr] md:gap-6 md:items-start">
        {/* Filter sidebar — sticky card on desktop, stacked above list on mobile */}
        <aside className="mb-4 md:mb-0 md:sticky md:top-24">
          <div className="md:bg-white md:border md:border-line md:rounded-card md:p-4">
            <div className="hidden md:flex items-center justify-between mb-3">
              <div className="text-[11px] font-mono uppercase tracking-wide text-ink">Filter</div>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-[11px] font-semibold text-orange hover:underline"
                >
                  Clear ({activeFilterCount})
                </button>
              )}
            </div>
            <input
              className="w-full bg-white border border-line rounded-[10px] px-3.5 py-2.5 text-[13.5px]"
              placeholder="Search name, area, or service..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5 mt-2.5 md:flex-col md:gap-2">
              {(["all", "available"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`font-mono text-[11.5px] px-3 py-2 rounded-full md:w-full md:text-center border transition-colors ${
                    statusFilter === f
                      ? "bg-teal text-white border-teal"
                      : "bg-white text-slate border-line hover:border-teal hover:text-teal"
                  }`}
                >
                  {f === "all" ? "All runners" : "🟢 Available now"}
                </button>
              ))}
            </div>

            {/* Advanced filters — desktop sidebar only */}
            <div className="hidden md:block">
              <div className="text-[11px] font-mono uppercase tracking-wide text-ink mt-4 mb-2">
                Service
              </div>
              {allServices.length === 0 ? (
                <div className="text-[11.5px] text-slate italic">No services listed yet.</div>
              ) : (
                <div className="max-h-[130px] overflow-y-auto space-y-1.5 pr-1">
                  {allServices.map((name) => {
                    const checked = selectedServices.includes(name);
                    return (
                      <label
                        key={name}
                        className="flex items-center gap-2 text-[12.5px] cursor-pointer hover:text-ink text-slate"
                      >
                        <span className={checkbox(checked)}>
                          {checked && <span className="text-white text-[10px] leading-none">✓</span>}
                        </span>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggle(selectedServices, setSelectedServices, name)}
                        />
                        <span className="truncate">{name}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="text-[11px] font-mono uppercase tracking-wide text-ink mt-4 mb-2">
                Area
              </div>
              {allAreas.length === 0 ? (
                <div className="text-[11.5px] text-slate italic">No areas listed yet.</div>
              ) : (
                <div className="max-h-[130px] overflow-y-auto space-y-1.5 pr-1">
                  {allAreas.map((a) => {
                    const checked = selectedAreas.includes(a);
                    return (
                      <label
                        key={a}
                        className="flex items-center gap-2 text-[12.5px] cursor-pointer hover:text-ink text-slate"
                      >
                        <span className={checkbox(checked)}>
                          {checked && <span className="text-white text-[10px] leading-none">✓</span>}
                        </span>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggle(selectedAreas, setSelectedAreas, a)}
                        />
                        <span className="truncate">{a}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="text-[11px] font-mono uppercase tracking-wide text-ink mt-4 mb-2">
                Max price
              </div>
              <div className="flex items-center justify-between text-[12.5px] mb-1.5">
                <span className="text-slate">
                  {priceLimit === null || priceLimit >= maxPrice
                    ? "Any price"
                    : `Up to RM${priceLimit}`}
                </span>
                <span className="font-mono text-[11px] text-slate">max RM{maxPrice}</span>
              </div>
              <input
                type="range"
                min={0}
                max={maxPrice}
                step={1}
                value={priceLimit === null || priceLimit >= maxPrice ? maxPrice : priceLimit}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setPriceLimit(v >= maxPrice ? null : v);
                }}
                className="w-full accent-[#E85D2C]"
              />
            </div>
          </div>
        </aside>

        {/* Runner grid */}
        <div className="min-w-0">
          {!loaded ? (
            <LoadingState label="Loading runners…" />
          ) : runners.length === 0 ? (
            <div className="text-center bg-white border border-dashed border-line rounded-card px-5 py-10 mb-3.5">
              <div className="text-3xl mb-2.5">🧑‍🤝‍🧑</div>
              <div className="font-display font-bold text-[16px] mb-1">No runners nearby yet</div>
              <div className="text-[12px] text-slate leading-relaxed mb-4">
                JomCOD is just getting started in {areaLabel}. Want to help out your neighbours?
              </div>
              <Link href="/dashboard">
                <span className="inline-block bg-orange text-white rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold">
                  Become a runner
                </span>
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center bg-white border border-dashed border-line rounded-card px-5 py-10">
              <div className="text-2xl mb-2">🔍</div>
              <div className="font-display font-bold text-[16px] mb-1">Nothing matches</div>
              <div className="text-[12px] text-slate leading-relaxed">
                Try a different name, area, or service, or switch back to &quot;All&quot;.
              </div>
              <button
                onClick={clearFilters}
                className="mt-4 inline-block bg-orange text-white rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((runner) => (
                <RunnerCard key={runner.id} runner={runner} />
              ))}
            </div>
          )}

          {runners.length > 0 && (
            <div className="text-[11.5px] text-slate bg-paper2 rounded-lg px-3 py-2.5 mt-5 italic">
              Runners marked &quot;Offline&quot; stay visible so the community still knows they exist —
              just can&apos;t be requested until they toggle back on.
            </div>
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}
