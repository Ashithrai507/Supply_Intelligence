import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, demoState, riskOf, type InventoryRow, type RiskLevel } from "../api/client";
import DemoBadge from "../components/DemoBadge";
import RiskBadge from "../components/RiskBadge";
import { useHospital } from "../context/HospitalContext";

const RISK_OPTIONS: Array<"All" | RiskLevel> = ["All", "Critical", "High", "Medium", "Safe"];
const STOCK_OPTIONS = ["All", "In stock", "Out of stock"] as const;

function daysToExpiry(expiryDate: string): number {
  const ms = new Date(expiryDate).getTime() - Date.now();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function isCritical(row: InventoryRow): boolean {
  return String(row.criticality).toLowerCase() === "critical";
}

function formatDaysLeft(daysLeft: number | null): string {
  if (daysLeft == null || Number.isNaN(daysLeft)) return "n/a";
  if (!Number.isFinite(daysLeft)) return "no usage";
  return `${daysLeft.toFixed(1)}d`;
}

export default function Inventory() {
  const { activeHospitalId, activeHospital, isNetworkView } = useHospital();

  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [hospital, setHospital] = useState("All");
  const [medicine, setMedicine] = useState("All");
  const [risk, setRisk] = useState<"All" | RiskLevel>("All");
  const [maxDays, setMaxDays] = useState("");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [expiryRiskOnly, setExpiryRiskOnly] = useState(false);
  const [stockStatus, setStockStatus] = useState<(typeof STOCK_OPTIONS)[number]>("All");

  // Sync hospital dropdown with global active hospital context on change
  useEffect(() => {
    if (!isNetworkView && activeHospital) {
      setHospital(activeHospital.name);
    } else {
      setHospital("All");
    }
  }, [activeHospitalId, isNetworkView, activeHospital]);

  useEffect(() => {
    api
      .getInventory()
      .then((data) => {
        setRows(data);
        setIsDemo(demoState.active);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);


  const hospitals = useMemo(
    () => ["All", ...Array.from(new Set(rows.map((r) => r.hospital))).sort()],
    [rows],
  );
  const medicines = useMemo(
    () => ["All", ...Array.from(new Set(rows.map((r) => r.medicine))).sort()],
    [rows],
  );

  const filtered = useMemo(() => {
    const max = maxDays.trim() === "" ? null : Number(maxDays);
    const q = searchQuery.toLowerCase().trim();
    return rows.filter((r) => {
      if (q && !r.hospital.toLowerCase().includes(q) && !r.medicine.toLowerCase().includes(q)) return false;
      if (hospital !== "All" && r.hospital !== hospital) return false;
      if (medicine !== "All" && r.medicine !== medicine) return false;
      if (risk !== "All" && riskOf(r.days_left) !== risk) return false;
      if (max != null && !(r.days_left != null && r.days_left < max)) return false;
      if (criticalOnly && !isCritical(r)) return false;
      if (expiryRiskOnly && !(daysToExpiry(r.expiry_date) <= 14)) return false;
      if (stockStatus === "In stock" && !(r.current_quantity > 0)) return false;
      if (stockStatus === "Out of stock" && !(r.current_quantity <= 0)) return false;
      return true;
    });
  }, [rows, searchQuery, hospital, medicine, risk, maxDays, criticalOnly, expiryRiskOnly, stockStatus]);

  const resetFilters = () => {
    setSearchQuery("");
    setHospital("All");
    setMedicine("All");
    setRisk("All");
    setMaxDays("");
    setCriticalOnly(false);
    setExpiryRiskOnly(false);
    setStockStatus("All");
  };

  if (loading) return <p className="text-slate-600 p-8 text-center">Loading inventory data…</p>;
  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800 shadow-xs">
        <p className="font-semibold text-lg">Could not load inventory.</p>
        <p className="mt-1 text-sm">{error} — is the backend running on the configured API base URL?</p>
      </div>
    );
  }

  const selectCls = "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none shadow-2xs";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="font-['Outfit',sans-serif] text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            Inventory Intelligence {isDemo && <DemoBadge />}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Batch-level medical stock, consumption rates & days-to-stockout predictions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
            Showing {filtered.length} of {rows.length} records
          </span>
          {(searchQuery || hospital !== "All" || medicine !== "All" || risk !== "All" || maxDays || criticalOnly || expiryRiskOnly || stockStatus !== "All") && (
            <button
              onClick={resetFilters}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Filter Control Box */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-3">
        {/* Search bar + Main selects */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search hospital or medicine…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none shadow-2xs"
            />
            <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
          </div>

          <label className="flex items-center justify-between text-xs text-slate-600">
            <span>Hospital</span>
            <select className={selectCls} value={hospital} onChange={(e) => setHospital(e.target.value)}>
              {hospitals.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-between text-xs text-slate-600">
            <span>Medicine</span>
            <select className={selectCls} value={medicine} onChange={(e) => setMedicine(e.target.value)}>
              {medicines.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-between text-xs text-slate-600">
            <span>Risk Status</span>
            <select className={selectCls} value={risk} onChange={(e) => setRisk(e.target.value as "All" | RiskLevel)}>
              {RISK_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Secondary filters */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100 text-xs text-slate-700">
          <label className="flex items-center gap-1.5">
            <span>Stock Status</span>
            <select className={selectCls} value={stockStatus} onChange={(e) => setStockStatus(e.target.value as (typeof STOCK_OPTIONS)[number])}>
              {STOCK_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5">
            <span>Days Left &lt;</span>
            <input
              className={`${selectCls} w-20`}
              type="number"
              min={0}
              placeholder="e.g. 7"
              value={maxDays}
              onChange={(e) => setMaxDays(e.target.value)}
            />
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={criticalOnly}
              onChange={(e) => setCriticalOnly(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="font-medium text-slate-800">Critical items only</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={expiryRiskOnly}
              onChange={(e) => setExpiryRiskOnly(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="font-medium text-slate-800">Expiring soon (&le; 14 days)</span>
          </label>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center text-slate-500 shadow-xs">
          <p className="text-base font-semibold">No inventory matches these filters.</p>
          <p className="mt-1 text-xs">Try adjusting your search criteria or resetting filters.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200/80 text-xs">
              <thead className="bg-slate-50/90 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3 text-left">Facility</th>
                  <th className="px-4 py-3 text-left">Medicine</th>
                  <th className="px-4 py-3 text-right">Current Stock</th>
                  <th className="px-4 py-3 text-right">Avg Daily Usage</th>
                  <th className="px-4 py-3 text-right">Days Left</th>
                  <th className="px-4 py-3 text-left">Risk Assessment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filtered.map((r) => {
                  const level = riskOf(r.days_left);
                  return (
                    <tr key={`${r.hospital_id}-${r.medicine_id}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{r.hospital}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800">{r.medicine}</span>
                          {isCritical(r) && (
                            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                              Critical
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                        {r.current_quantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">
                        {r.avg_daily_usage.toFixed(1)} / day
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                        {formatDaysLeft(r.days_left)}
                      </td>
                      <td className="px-4 py-3">
                        <RiskBadge level={level} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
        <p>Need exact decision explanations for transfers?</p>
        <Link className="font-semibold text-indigo-600 hover:text-indigo-800 underline" to="/">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

