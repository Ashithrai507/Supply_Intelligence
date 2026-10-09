import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Search,
  Truck,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getHospitalsList, getInventoryRows, getStockoutRisks } from "../api/medpredict";
import type { StockoutRiskItem } from "../api/medpredict";
import type { HospitalOption } from "../api/forecast";
import type { InventoryRow } from "../api/client";
import { riskOf } from "../api/client";
import { addPlannedTransfer } from "../api/plannedTransfers";
import { useAuth } from "../context/AuthContext";
import RiskBadge from "../components/RiskBadge";

function daysToExpiry(expiryDate: string): number {
  return Math.floor((new Date(expiryDate).getTime() - Date.now()) / 86400000);
}

export default function Expiry() {
  const { user } = useAuth();
  const currentHospitalName = user?.name ?? "Hospital A";

  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [urgencyFilter, setUrgencyFilter] = useState<"all" | "7d" | "14d">("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Redistribute flow: pick recipients with real demand for the surplus medicine.
  type ExpiryRow = InventoryRow & { dte: number; expectedUse: number; surplus: number };
  interface PlannedTransfer { to_id: string; to: string; qty: number }
  const [redistributeRow, setRedistributeRow] = useState<ExpiryRow | null>(null);
  const [candidates, setCandidates] = useState<StockoutRiskItem[]>([]);
  const [candLoading, setCandLoading] = useState(false);
  const [hospitalNames, setHospitalNames] = useState<Record<string, string>>({});
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});
  const [planned, setPlanned] = useState<PlannedTransfer[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);

  function openRedistribute(row: ExpiryRow) {
    setRedistributeRow(row);
    setCandidates([]);
    setQtyInputs({});
    setPlanned([]);
    setSendError(null);
    setCandLoading(true);
    getHospitalsList()
      .then((hospitals: HospitalOption[]) => {
        setHospitalNames(Object.fromEntries(hospitals.map((h) => [h.id, h.name])));
        return Promise.all(
          hospitals
            .filter((h) => h.id !== row.hospital_id)
            .map((h) => getStockoutRisks(h.id).catch((): StockoutRiskItem[] => [])),
        );
      })
      .then((perHospital) => {
        const found = perHospital
          .flat()
          .filter((r) => r.medicine_id === row.medicine_id && r.risk_level !== "LOW")
          .sort((a, b) => (a.days_until_stockout ?? 999) - (b.days_until_stockout ?? 999));
        setCandidates(found);
      })
      .catch((err: unknown) => setSendError(err instanceof Error ? err.message : String(err)))
      .finally(() => setCandLoading(false));
  }

  function remainingSurplus(): number {
    if (!redistributeRow) return 0;
    const sent = planned.reduce((s, p) => s + p.qty, 0);
    return Math.max(0, redistributeRow.surplus - sent);
  }

  function sendTo(c: StockoutRiskItem, hospitalName: string) {
    if (!redistributeRow) return;
    const remaining = remainingSurplus();
    const wanted = Number(
      qtyInputs[c.hospital_id] || Math.min(remaining, Math.ceil(c.daily_demand * 7)),
    );
    if (!Number.isFinite(wanted) || wanted <= 0) {
      setSendError("Enter a positive quantity.");
      return;
    }
    if (wanted > remaining) {
      setSendError(`Only ${remaining.toLocaleString()} surplus units left to send.`);
      return;
    }
    setSendError(null);
    const qty = Math.floor(wanted);
    setPlanned((prev) => [...prev, { to_id: c.hospital_id, to: hospitalName, qty }]);
    setQtyInputs((prev) => ({ ...prev, [c.hospital_id]: "" }));
    addPlannedTransfer({
      id: `manual-${Date.now()}`,
      from_id: redistributeRow.hospital_id,
      from: redistributeRow.hospital,
      to_id: c.hospital_id,
      to: hospitalName,
      medicine: redistributeRow.medicine,
      quantity: qty,
      score: Math.min(96, 55 + Math.round(qty / 50)),
      reasons: [
        `Manual redistribution from Expiry page — ${redistributeRow.surplus.toLocaleString()} surplus units expiring in ${redistributeRow.dte} days.`,
        `${hospitalName} has ${c.days_until_stockout != null ? `${c.days_until_stockout.toFixed(1)} days of cover` : "unknown cover"} (${c.risk_level}).`,
      ],
      date: new Date().toISOString().slice(0, 10),
    });
  }

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    getInventoryRows(user.id)
      .then(setInventory)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const allExpiryRows = useMemo(
    () =>
      inventory
        .filter((r) => r.hospital === currentHospitalName)
        .map((r) => {
          const dte = daysToExpiry(r.expiry_date);
          const expectedUse = Math.round(r.avg_daily_usage * Math.max(dte, 0));
          const surplus = Math.max(0, r.current_quantity - expectedUse);
          return { ...r, dte, expectedUse, surplus };
        })
        .filter((r) => r.surplus > 0)
        .sort((a, b) => b.surplus - a.surplus),
    [inventory, currentHospitalName],
  );

  const filteredRows = useMemo(() => {
    return allExpiryRows.filter((r) => {
      if (urgencyFilter === "7d" && r.dte > 7) return false;
      if (urgencyFilter === "14d" && r.dte > 14) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesMed = r.medicine.toLowerCase().includes(q);
        const matchesHosp = r.hospital.toLowerCase().includes(q);
        if (!matchesMed && !matchesHosp) return false;
      }
      return true;
    });
  }, [allExpiryRows, urgencyFilter, searchTerm]);

  const totalWaste = filteredRows.reduce((s, r) => s + r.surplus, 0);
  const estimatedCostSaved = totalWaste * 18.5; // ~$18.5 avg unit value

  const chartData = useMemo(() => {
    return filteredRows.map((r) => ({
      name: `${r.hospital.split(" ")[0]} - ${r.medicine.split(" ")[0]}`,
      surplus: r.surplus,
      dte: r.dte,
      hospital: r.hospital,
      medicine: r.medicine,
    }));
  }, [filteredRows]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm font-semibold text-slate-500">
        Loading expiry risk signals…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6 text-rose-900 shadow-sm">
        <h3 className="font-bold">Could not load live expiry data</h3>
        <p className="mt-1 text-xs text-rose-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {currentHospitalName} — Expiry Risk & Waste Mitigation
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Identify surplus medicine lots destined to expire before historical patient burn rates for {currentHospitalName}.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800">Total Units At Waste Risk</span>
            <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white">
              Surplus
            </span>
          </div>
          <p className="mt-2 text-3xl font-extrabold text-amber-900">{totalWaste.toLocaleString()}</p>
          <p className="text-xs text-amber-700 mt-1">
            Overstocked beyond expected consumption before expiry.
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800">Recoverable Value</span>
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
              Value Preservation
            </span>
          </div>
          <p className="mt-2 text-3xl font-extrabold text-emerald-900">${Math.round(estimatedCostSaved).toLocaleString()}</p>
          <p className="text-xs text-emerald-700 mt-1">
            Potential loss prevented via proactive redistribution.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Batches Monitored</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              Active Lots
            </span>
          </div>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">{filteredRows.length}</p>
          <p className="text-xs text-slate-500 mt-1">
            Hospital stock records with surplus expiry inventory.
          </p>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Surplus Units Likely to Expire Unused (Highest Waste First)
            </h3>
            <p className="text-xs text-slate-500">
              Calculated as: Current Quantity minus (Avg Daily Usage × Days to Expiry)
            </p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} interval={0} angle={-15} textAnchor="end" height={45} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg">
                      <p className="font-bold text-slate-900">{d.medicine}</p>
                      <p className="text-[11px] text-slate-500">{d.hospital}</p>
                      <div className="mt-1 flex items-center justify-between gap-4 font-semibold">
                        <span className="text-slate-600">Surplus waste:</span>
                        <span className="text-amber-600 font-bold">{d.surplus.toLocaleString()} units</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-slate-500 text-[11px]">
                        <span>Expires in:</span>
                        <span>{d.dte} days</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="surplus" radius={[4, 4, 0, 0]}>
              {chartData.map((c) => (
                <Cell key={c.name} fill={c.dte <= 7 ? "#f97316" : "#f59e0b"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Interactive Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1 text-xs">
          <button
            onClick={() => setUrgencyFilter("all")}
            className={`rounded-md px-3 py-1 font-semibold transition-colors ${
              urgencyFilter === "all" ? "bg-indigo-600 text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Surplus ({allExpiryRows.length})
          </button>
          <button
            onClick={() => setUrgencyFilter("14d")}
            className={`rounded-md px-3 py-1 font-semibold transition-colors ${
              urgencyFilter === "14d" ? "bg-amber-600 text-white" : "text-amber-800 hover:bg-amber-50"
            }`}
          >
            Expires ≤ 14 Days
          </button>
          <button
            onClick={() => setUrgencyFilter("7d")}
            className={`rounded-md px-3 py-1 font-semibold transition-colors ${
              urgencyFilter === "7d" ? "bg-rose-600 text-white" : "text-rose-700 hover:bg-rose-50"
            }`}
          >
            🚨 Critical ≤ 7 Days
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search expiring batch..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 rounded-xl border border-slate-200 bg-white pl-8 pr-7 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expiry Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredRows.map((r) => {
          const wastePercent = Math.min(100, Math.round((r.surplus / r.current_quantity) * 100));

          return (
            <div
              key={`${r.hospital_id}-${r.medicine_id}`}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-amber-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{r.hospital}</h3>
                  <p className="text-xs font-semibold text-indigo-600 mt-0.5">{r.medicine}</p>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${r.dte <= 7 ? "bg-rose-100 text-rose-800 border border-rose-200" : "bg-amber-100 text-amber-800 border border-amber-200"}`}>
                  <CalendarClock className="h-3 w-3" />
                  <span>Expires in {r.dte} days</span>
                </span>
              </div>

              {/* Visual Breakdown Bar: Expected Use vs Waste */}
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-slate-600">
                  <span>Usage vs Surplus Waste</span>
                  <span className="font-bold text-amber-700">{wastePercent}% Likely Waste</span>
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${100 - wastePercent}%` }}
                    title={`Expected clinical consumption: ${r.expectedUse.toLocaleString()} units`}
                  />
                  <div
                    className="h-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${wastePercent}%` }}
                    title={`Surplus at risk: ${r.surplus.toLocaleString()} units`}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span className="text-emerald-700 font-semibold">● Expected use: {r.expectedUse.toLocaleString()}</span>
                  <span className="text-amber-700 font-semibold">● Unused surplus: {r.surplus.toLocaleString()}</span>
                </div>
              </div>

              {/* Data Table */}
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-slate-50 p-2">
                  <dt className="text-[11px] text-slate-500">Current Stock</dt>
                  <dd className="font-bold text-slate-900 mt-0.5">{r.current_quantity.toLocaleString()} units</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <dt className="text-[11px] text-slate-500">Likely Waste</dt>
                  <dd className="font-bold text-amber-700 mt-0.5">{r.surplus.toLocaleString()} units</dd>
                </div>
              </dl>

              {/* Action Banner */}
              <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                <span className="text-slate-500">
                  Batch date: <strong className="text-slate-700">{r.expiry_date}</strong>
                </span>

                <button
                  type="button"
                  onClick={() => openRedistribute(r)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white shadow-sm hover:bg-amber-700 transition-colors"
                >
                  <Truck className="h-3.5 w-3.5" />
                  <span>Redistribute Surplus</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {redistributeRow && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4" onClick={() => setRedistributeRow(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-gray-200 bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold">
                  Redistribute {redistributeRow.surplus.toLocaleString()} surplus units
                </h3>
                <p className="text-sm text-gray-600">
                  {redistributeRow.medicine} · from {redistributeRow.hospital} ·
                  expires in {redistributeRow.dte} days
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRedistributeRow(null)}
                className="rounded border border-gray-300 px-2 py-0.5 text-sm hover:bg-gray-100"
              >
                Close
              </button>
            </div>

            <div className="mt-3 grid gap-4 md:grid-cols-5">
              <div className="md:col-span-2">
                <h4 className="mb-2 font-semibold">Surplus at {redistributeRow.hospital}</h4>
                <div className="rounded border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Extra units</p>
                    <RiskBadge level={riskOf(redistributeRow.days_left)} />
                  </div>
                  <p className="text-2xl font-bold">
                    {redistributeRow.surplus.toLocaleString()}
                  </p>
                  <dl className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Current stock</dt>
                      <dd className="font-medium">{redistributeRow.current_quantity.toLocaleString()}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Expected use</dt>
                      <dd className="font-medium">{redistributeRow.expectedUse.toLocaleString()}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Expires in</dt>
                      <dd className="font-medium">{redistributeRow.dte} days</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Remaining to place</dt>
                      <dd className="font-semibold">{remainingSurplus().toLocaleString()}</dd>
                    </div>
                  </dl>
                </div>
                {planned.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {planned.map((p, i) => (
                      <li key={`${p.to_id}-${i}`} className="rounded bg-green-50 px-2 py-1 text-sm text-green-800">
                        {p.qty.toLocaleString()} units → {p.to} · saved to Transfers
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="md:col-span-3">
                <h4 className="mb-2 font-semibold">Top 3 hospitals with demand</h4>
            {candLoading ? (
              <p className="text-sm text-gray-600">Finding demand across the network…</p>
            ) : candidates.length === 0 ? (
              <p className="rounded border border-gray-200 p-4 text-center text-sm text-gray-600">
                No other hospital currently shows demand for this medicine.
              </p>
            ) : (
              <ul className="space-y-2">
                {candidates.slice(0, 3).map((c) => {
                  const suggested = Math.min(
                    remainingSurplus(),
                    Math.ceil(c.daily_demand * 7),
                  );
                  const hospitalName = hospitalNames[c.hospital_id] ?? c.hospital_id;
                  return (
                    <li key={c.hospital_id} className="rounded border border-gray-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{hospitalName}</p>
                        <RiskBadge
                          level={
                            c.risk_level === "CRITICAL" ? "Critical"
                            : c.risk_level === "HIGH" ? "High"
                            : c.risk_level === "MEDIUM" ? "Medium" : "Safe"
                          }
                        />
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {c.days_until_stockout != null
                          ? `${c.days_until_stockout.toFixed(1)} days of cover`
                          : "cover unknown"}{" "}
                        · ~{c.daily_demand.toFixed(0)}/day
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={remainingSurplus()}
                          placeholder={String(suggested)}
                          value={qtyInputs[c.hospital_id] ?? ""}
                          onChange={(e) => setQtyInputs((prev) => ({ ...prev, [c.hospital_id]: e.target.value }))}
                          className="w-28 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => sendTo(c, hospitalName)}
                          className="rounded bg-gray-900 px-3 py-1 text-sm font-semibold text-white hover:bg-gray-700"
                        >
                          Send
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {sendError && <p className="mt-2 text-sm text-red-700">{sendError}</p>}
            {candidates.length > 3 && (
              <p className="mt-2 text-xs text-gray-500">
                +{candidates.length - 3} more hospitals with demand — showing top 3 most urgent.
              </p>
            )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
