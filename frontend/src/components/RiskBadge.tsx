import type { RiskLevel } from "../api/client";

const STYLES: Record<RiskLevel, { dot: string; classes: string }> = {
  Critical: { dot: "bg-red-600", classes: "bg-red-100 text-red-800 border-red-300" },
  High: { dot: "bg-orange-500", classes: "bg-orange-100 text-orange-800 border-orange-300" },
  Medium: { dot: "bg-yellow-500", classes: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  Safe: { dot: "bg-green-600", classes: "bg-green-100 text-green-800 border-green-300" },
};

/** Shared risk badge — the single visual source of truth for risk levels.
 * Color dot + text label only: red Critical, orange High, yellow Medium, green Safe. */
export default function RiskBadge({ level }: { level: RiskLevel }) {
  const { dot, classes } = STYLES[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${classes}`}
    >
      <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${dot}`} />
      {level}
    </span>
  );
}
