export default function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="space-y-3" role="status" aria-label={label}>
      <div className="animate-pulse">
        <div className="h-5 w-1/3 bg-line/60 rounded-md mb-3" />
        <div className="h-3 w-1/2 bg-line/50 rounded mb-2" />
        <div className="h-24 bg-line/40 rounded-card" />
      </div>
      <div className="animate-pulse delay-150">
        <div className="h-24 bg-line/30 rounded-card" />
      </div>
      <div className="animate-pulse delay-300">
        <div className="h-24 bg-line/30 rounded-card" />
      </div>
      <div className="text-center text-[11.5px] text-slate">{label}</div>
    </div>
  );
}
