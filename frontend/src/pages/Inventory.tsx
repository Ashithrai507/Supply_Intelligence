import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, demoState, riskOf, type InventoryRow, type RiskLevel } from "../api/client";
import DemoBadge from "../components/DemoBadge";
import RiskBadge from "../components/RiskBadge";

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

/** Inventory milestone: live stock + demand + days-left + risk table with 7 combinable filters. */
export default function Inventory() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const [hospital, setHospital] = useState("All");
  const [medicine, setMedicine] = useState("All");
  const [risk, setRisk] = useState<"All" | RiskLevel>("All");
  const [maxDays, setMaxDays] = useState("");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [expiryRiskOnly, setExpiryRiskOnly] = useState(false);
  const [stockStatus, setStockStatus] = useState<(typeof STOCK_OPTIONS)[number]>("All");

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
    return rows.filter((r) => {
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
  }, [rows, hospital, medicine, risk, maxDays, criticalOnly, expiryRiskOnly, stockStatus]);

  if (loading) return <p className="text-gray-600">Loading inventory…</p>;
  if (error) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-4 text-red-800">
        <p className="font-semibold">Could not load inventory.</p>
        <p className="text-sm">{error} — is the backend running on the configured API base URL?</p>
      </div>
    );
  }

  const selectCls = "rounded border border-gray-300 px-2 py-1 text-sm";
  const checkCls = "flex items-center gap-1 text-sm";

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Inventory {isDemo && <DemoBadge />}</h2>
        <p className="text-sm text-gray-600">
          Showing {filtered.length} of {rows.length} records
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 rounded border border-gray-200 bg-gray-50 p-3">
        <label className={checkCls}>
          Hospital{" "}
          <select className={selectCls} value={hospital} onChange={(e) => setHospital(e.target.value)}>
            {hospitals.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </label>
        <label className={checkCls}>
          Medicine{" "}
          <select className={selectCls} value={medicine} onChange={(e) => setMedicine(e.target.value)}>
            {medicines.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className={checkCls}>
          Risk{" "}
          <select className={selectCls} value={risk} onChange={(e) => setRisk(e.target.value as "All" | RiskLevel)}>
            {RISK_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className={checkCls}>
          Days left &lt;{" "}
          <input
            className={`${selectCls} w-20`}
            type="number"
            min={0}
            placeholder="e.g. 7"
            value={maxDays}
            onChange={(e) => setMaxDays(e.target.value)}
          />
        </label>
        <label className={checkCls}>
          Stock{" "}
          <select className={selectCls} value={stockStatus} onChange={(e) => setStockStatus(e.target.value as (typeof STOCK_OPTIONS)[number])}>
            {STOCK_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className={checkCls}>
          <input type="checkbox" checked={criticalOnly} onChange={(e) => setCriticalOnly(e.target.checked)} />
          Critical only
        </label>
        <label className={checkCls}>
          <input type="checkbox" checked={expiryRiskOnly} onChange={(e) => setExpiryRiskOnly(e.target.checked)} />
          Expiry risk (expires within 14 days)
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded border border-gray-200 bg-white p-6 text-center text-gray-600">
          No inventory matches these filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
            <thead className="bg-gray-100">
              <tr>
                {["Hospital", "Medicine", "Stock", "Avg Daily Demand", "Days Left", "Risk"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-semibold text-gray-700">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => {
                const level = riskOf(r.days_left);
                return (
                  <tr key={`${r.hospital_id}-${r.medicine_id}`} className="hover:bg-gray-50">
                    <td className="px-3 py-2">{r.hospital}</td>
                    <td className="px-3 py-2">
                      {r.medicine}
                      {isCritical(r) && (
                        <span className="ml-1 rounded bg-red-600 px-1 text-[10px] font-bold uppercase text-white">
                          Critical
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{r.current_quantity.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{r.avg_daily_usage.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right">{formatDaysLeft(r.days_left)}</td>
                    <td className="px-3 py-2"><RiskBadge level={level} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-sm text-gray-500">
        Need the full decision chain for a hospital? Hospital drill-down arrives in a later task.{" "}
        <Link className="underline" to="/">Back to Dashboard</Link>
      </p>
    </div>
  );
}
