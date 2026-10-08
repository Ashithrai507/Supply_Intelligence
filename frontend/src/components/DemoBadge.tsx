/** Honesty badge: shown when the page renders filler data (backend unreachable). */
export default function DemoBadge() {
  return (
    <span
      title="Live backend unreachable — showing filler demo data"
      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
      Demo data
    </span>
  );
}

