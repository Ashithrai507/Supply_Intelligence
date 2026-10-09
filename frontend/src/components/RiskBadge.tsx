import type { RiskLevel } from "../api/client";

interface RiskBadgeProps {
  level: RiskLevel;
  size?: "sm" | "md";
  showPulse?: boolean;
}

const STYLES: Record<
  RiskLevel,
  { dot: string; ping: string; classes: string }
> = {
  Critical: {
    dot: "bg-rose-600",
    ping: "bg-rose-400",
    classes: "bg-rose-50 text-rose-700 border-rose-200 shadow-sm shadow-rose-100/50 dark:text-rose-300 dark:border-rose-800",
  },
  High: {
    dot: "bg-amber-500",
    ping: "bg-amber-400",
    classes: "bg-amber-50 text-amber-800 border-amber-200 shadow-sm shadow-amber-100/50 dark:text-amber-200 dark:border-amber-800",
  },
  Medium: {
    dot: "bg-yellow-500",
    ping: "bg-yellow-400",
    classes: "bg-yellow-50 text-yellow-800 border-yellow-200 dark:text-yellow-200 dark:border-yellow-800",
  },
  Safe: {
    dot: "bg-emerald-600",
    ping: "bg-emerald-400",
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-800",
  },
};

/** Shared risk badge — the single visual source of truth for risk levels.
 * Upgraded with animated alert pulses for critical items and high-contrast clinical tints. */
export default function RiskBadge({ level, size = "sm", showPulse = true }: RiskBadgeProps) {
  const { dot, ping, classes } = STYLES[level] ?? STYLES.Safe;
  const isCritical = level === "Critical" && showPulse;

  const sizeCls = size === "md" ? "px-2.5 py-1 text-xs font-semibold" : "px-2 py-0.5 text-[11px] font-semibold";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border transition-all ${sizeCls} ${classes}`}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {isCritical && (
          <span
            aria-hidden
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${ping}`}
          />
        )}
        <span aria-hidden className={`relative inline-block h-2 w-2 rounded-full ${dot}`} />
      </span>
      <span>{level}</span>
    </span>
  );
}
