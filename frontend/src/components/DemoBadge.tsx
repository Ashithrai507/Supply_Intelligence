import { Activity } from "lucide-react";

/** Honesty badge: shown when the page renders presentation filler data (backend unreachable). */
export default function DemoBadge() {
  return (
    <span
      title="Live backend unreachable — showing simulated presentation data"
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/90 px-2.5 py-0.5 text-xs font-medium text-amber-800 shadow-sm dark:text-amber-200 dark:border-amber-800"
    >
      <Activity className="h-3 w-3 text-amber-600 animate-pulse" />
      <span>Simulated Demo</span>
    </span>
  );
}
