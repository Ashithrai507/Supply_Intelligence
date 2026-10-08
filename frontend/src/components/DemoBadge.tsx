/** Honesty badge: shown when the page renders filler data (backend unreachable). */
export default function DemoBadge() {
  return (
    <span
      title="Live backend unreachable — showing filler demo data"
      className="inline-block rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"
    >
      Demo data
    </span>
  );
}
