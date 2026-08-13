import Link from "next/link";
import { cleanServiceName, titleCase } from "@/lib/constants";
import { Runner, RunnerStatus } from "@/lib/types";
import StatusPill from "./StatusPill";
import { pricingDisplay, pricingLabel } from "@/lib/mockData";

const STATUS_EDGE: Record<RunnerStatus, string> = {
  available: "#2E6E62",
  busy: "#F2B705",
  delivery: "#E85D2C",
  offline: "#9AA09C",
};

export default function RunnerCard({ runner }: { runner: Runner }) {
  const firstService = runner.services[0];
  const isCustom = firstService?.pricing.model === "custom";

  const hasRating = runner.rating !== null && runner.rating !== undefined;
  const hasJobs = runner.jobsCompleted > 0;
  const thirdValue =
    runner.distanceKm > 0
      ? `📍 ${runner.distanceKm}km`
      : runner.acceptRate !== null
      ? `${runner.acceptRate}%`
      : "—";
  const hasThird = thirdValue !== "—";
  const thirdLabel =
    runner.distanceKm > 0 ? "Distance" : runner.acceptRate !== null ? "Accept" : "Distance";

  return (
    <Link
      href={`/runner/${runner.id}`}
      style={{ borderLeftColor: STATUS_EDGE[runner.status] }}
      className="flex gap-2.5 p-3 bg-white border border-line border-l-[4px] rounded-card mb-3 md:mb-0 hover:border-[#C4BB9F] transition-colors"
    >
      <div
        className="w-10 h-10 rounded-[10px] flex-shrink-0 self-start flex items-center justify-center font-display font-bold text-sm text-white"
        style={{ background: runner.avatarColor }}
      >
        {runner.avatarInitials}
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header: name (primary) + price pill (secondary) */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-display font-bold text-[13.5px] leading-snug break-words">
              {runner.name}
            </div>
            <div className="text-[10.5px] font-semibold text-slate mt-0.5 break-words">
              {runner.area}
            </div>
          </div>
          <div className="text-right flex-shrink-0 max-w-[110px]">
            <span
              className={`inline-block font-mono font-semibold text-[11.5px] text-[#B84A20] bg-[#FDEFE3] rounded-full px-2 py-0.5 leading-tight ${
                isCustom ? "max-w-full truncate" : "whitespace-nowrap"
              }`}
            >
              {pricingDisplay(runner)}
            </span>
            {firstService && (
              <span className="block text-[8px] font-medium text-slate uppercase tracking-wide mt-0.5">
                {pricingLabel(firstService.pricing.model)}
              </span>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="mt-2">
          <StatusPill status={runner.status} note={runner.statusNote} />
        </div>

        {/* Stats + services, pushed down to fill the card */}
        <div className="mt-auto pt-2">
          <div className="pt-2 border-t border-line">
            <div className="grid grid-cols-3 gap-1">
              {/* Rating — soft yellow */}
              <div
                className={`rounded-[6px] py-1.5 text-center border ${
                  hasRating
                    ? "bg-[#FDF6E3] border-[#EDD38A]"
                    : "bg-[#FBF6E9] border-dashed border-line"
                }`}
                title={hasRating ? undefined : "No reviews yet"}
              >
                <div className={`font-mono font-bold text-[12px] ${hasRating ? "text-[#8A6D00]" : "text-slate"}`}>
                  <span className="text-yellow">★</span> {hasRating ? runner.rating : "New"}
                </div>
                <div className="text-[7.5px] text-slate uppercase tracking-wide mt-0.5">Rating</div>
              </div>

              {/* Jobs done — soft teal */}
              <div
                className={`rounded-[6px] py-1.5 text-center border ${
                  hasJobs ? "bg-[#E4F3EC] border-[#B9DFCD]" : "bg-[#F0F7F4] border-dashed border-line"
                }`}
              >
                <div className={`font-mono font-bold text-[12px] ${hasJobs ? "text-teal" : "text-slate"}`}>
                  {runner.jobsCompleted}
                </div>
                <div className="text-[7.5px] text-slate uppercase tracking-wide mt-0.5">Jobs</div>
              </div>

              {/* Distance / accept rate — soft gray */}
              <div
                className={`rounded-[6px] py-1.5 text-center border ${
                  hasThird ? "bg-[#F1EFE8] border-[#D8D0BC]" : "bg-[#F3F1EA] border-dashed border-line"
                }`}
                title={hasThird ? undefined : "Not available yet"}
              >
                <div className={`font-mono font-bold text-[12px] ${hasThird ? "text-ink" : "text-slate"}`}>
                  {thirdValue}
                </div>
                <div className="text-[7.5px] text-slate uppercase tracking-wide mt-0.5">
                  {thirdLabel === "Accept" ? "Accept" : "Dist"}
                </div>
              </div>
            </div>

            <div className="mt-2">
              <div className="text-[8.5px] font-semibold uppercase tracking-wide text-slate">
                Service:
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {runner.services.length > 0 ? (
                  runner.services.map((s) => (
                    <span
                      key={s.id}
                      className="text-[9.5px] bg-[#E4F3EC] text-teal border border-[#C9E3D6] px-1.5 py-0.5 rounded"
                    >
                      {titleCase(cleanServiceName(s.name))}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-slate italic">No services listed yet</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
