import { useEffect, useMemo, useState } from "react";
import { getNetworkPriorities, type PriorityRow } from "../api/medpredict";
import { useAuth } from "../context/AuthContext";
import RiskBadge from "../components/RiskBadge";

const DIMENSIONS = [
  { key: "patientLoad", label: "Patient load" },
  { key: "emergency", label: "Emergency" },
  { key: "stockout", label: "Stock-out" },
  { key: "criticality", label: "Criticality" },
  { key: "alternatives", label: "No alternative" },
] as const;

/** Priority ranking: one clean ranked list from live stock-out risk signals.
 * Click a row to expand its score breakdown. */
export default function Priority() {
  const { user } = useAuth();
  const currentHospitalName = user?.name ?? "Hospital A";

  const [priorities, setPriorities] = useState<PriorityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<"All" | "Critical" | "High" | "Medium">("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    getNetworkPriorities()
      .then(setPriorities)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return priorities.filter((p) => {
      if (levelFilter !== "All" && p.level !== levelFilter) return false;
      if (q && !p.hospital.toLowerCase().includes(q) && !p.reason.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [priorities, levelFilter, searchTerm]);

  const myRank = priorities.findIndex((p) => p.hospital === currentHospitalName) + 1;

  if (loading) {
    return <p className="py-16 text-center text-sm text-slate-500">Computing priority scores…</p>;
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-5">
        <p className="font-semibold text-red-800">Could not load priorities.</p>
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Supply Priority Ranking</h1>
        <p className="text-sm text-slate-500">
          Who needs incoming stock first — scored 0–100 from live stock-out risk signals.
          {myRank > 0 && (
            <> Your facility: <strong>rank #{myRank}</strong>.</>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Filter by tier"
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as "All" | "Critical" | "High" | "Medium")}
        >
          <option value="All">All tiers ({priorities.length})</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
        </select>
        <input
          type="text"
          placeholder="Search facility…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          No facilities match these filters.
        </p>
      ) : (
        <ol className="space-y-2">
          {filtered.map((p, i) => {
            const isMine = p.hospital === currentHospitalName;
            const expanded = expandedId === p.hospital_id;
            return (
              <li key={p.hospital_id} className="rounded-xl border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : p.hospital_id)}
                  className="flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50"
                >
                  <span className="w-8 shrink-0 text-lg font-extrabold text-slate-400">#{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-900">
                      {p.hospital}
                      {isMine && <span className="ml-2 text-[10px] font-bold uppercase text-indigo-600">Your facility</span>}
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <span className="block h-full rounded-full bg-indigo-600" style={{ width: `${p.score}%` }} />
                    </span>
                    <span className="mt-1 block truncate text-xs text-slate-500">Why: {p.reason}</span>
                  </span>
                  <span className="text-lg font-extrabold text-slate-900">{p.score}</span>
                  <RiskBadge level={p.level} />
                </button>
                {expanded && (
                  <div className="space-y-1 border-t border-slate-100 px-3 py-2">
                    {DIMENSIONS.map((d) => (
                      <div key={d.key} className="flex items-center gap-2 text-xs">
                        <span className="w-24 shrink-0 text-slate-500">{d.label}</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                          <span className="block h-full rounded-full bg-slate-500" style={{ width: `${Math.min(100, (p.breakdown[d.key] / 30) * 100)}%` }} />
                        </span>
                        <span className="w-6 text-right text-slate-600">{p.breakdown[d.key]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
