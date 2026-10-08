import type { RiskLevel } from "../api/client";

const STYLES: Record<RiskLevel, { dot: string; classes: string }> = {
  Critical: {
    dot: "bg-rose-500 animate-pulse",
    classes: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20",
  },
  High: {
    dot: "bg-amber-500",
    classes: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20",
  },
  Medium: {
    dot: "bg-orange-400",
    classes: "bg-orange-50 text-orange-800 ring-1 ring-inset ring-orange-600/20",
  },
  Safe: {
    dot: "bg-emerald-500",
    classes: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  },
};

/** Shared risk badge — single source of truth for risk levels. */
export default function RiskBadge({ level }: { level: RiskLevel }) {
  const { dot, classes } = STYLES[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}
    >
      <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
      {level}
    </span>
  );
}

