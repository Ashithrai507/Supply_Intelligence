import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle,
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
import { riskOf, type InventoryRow } from "../api/client";
import { getInventoryRows } from "../api/medpredict";
import { useAuth } from "../context/AuthContext";
import RiskBadge from "../components/RiskBadge";

const BAR_COLORS: Record<string, string> = {
  Critical: "#e11d48", // rose-600
  High: "#f97316",     // orange-500
  Medium: "#eab308",   // yellow-500
  Safe: "#10b981",     // emerald-500
};

export default function Shortage() {
  const { user } = useAuth();
  const currentHospitalName = user?.name ?? "Hospital A";

  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [feasibilityFilter, setFeasibilityFilter] = useState<"all" | "breached" | "safe">("all");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    getInventoryRows(user.id)
      .then(setInventory)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const allAtRisk = useMemo(
    () =>
      inventory
        .filter((r) => r.hospital === currentHospitalName && (r.days_left ?? 999) <= 14)
        .sort((a, b) => (a.days_left ?? 999) - (b.days_left ?? 999)),
    [inventory, currentHospitalName],
  );

  const filteredItems = useMemo(() => {
    return allAtRisk.filter((r) => {
      const days = r.days_left ?? 0;
      const covered = days > r.supplier_lead_time_days;

      if (feasibilityFilter === "breached" && covered) return false;
      if (feasibilityFilter === "safe" && !covered) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesMed = r.medicine.toLowerCase().includes(q);
        const matchesHosp = r.hospital.toLowerCase().includes(q);
        if (!matchesMed && !matchesHosp) return false;
      }
      return true;
    });
  }, [allAtRisk, feasibilityFilter, searchTerm]);

  const chartData = useMemo(() => {
    return allAtRisk.slice(0, 8).map((r) => ({
      name: r.medicine,
      days: Number((r.days_left ?? 0).toFixed(1)),
      level: riskOf(r.days_left),
      hospital: r.hospital,
      medicine: r.medicine,
      leadTime: r.supplier_lead_time_days,
    }));
  }, [allAtRisk]);

  const breachedCount = allAtRisk.filter((r) => (r.days_left ?? 0) <= r.supplier_lead_time_days).length;
  const safeCount = allAtRisk.filter((r) => (r.days_left ?? 0) > r.supplier_lead_time_days).length;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm font-semibold text-slate-500">
        Loading shortage signals…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6 text-rose-900 shadow-sm">
        <h3 className="font-bold">Could not load live shortage data</h3>
        <p className="mt-1 text-xs text-rose-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl animate-bounce">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {currentHospitalName} — Critical Shortage Prevention
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Diagnostic comparison of days of supply remaining vs supplier procurement turnaround for {currentHospitalName}.
          </p>
        </div>
      </div>

      {/* Summary Alert Box */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800">Cannot Resupply in Time</span>
            <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
              Redistribution Required
            </span>
          </div>
          <p className="mt-2 text-3xl font-extrabold text-rose-900">{breachedCount}</p>
          <p className="text-xs text-rose-700 mt-1">
            Supplier lead time exceeds remaining stock.
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800">Procurement Feasible</span>
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
              PO Expedited
            </span>
          </div>
          <p className="mt-2 text-3xl font-extrabold text-emerald-900">{safeCount}</p>
          <p className="text-xs text-emerald-700 mt-1">
            Stock covers supplier turnaround window.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Total Items At-Risk</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              ≤14 Days Cover
            </span>
          </div>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">{allAtRisk.length}</p>
          <p className="text-xs text-slate-500 mt-1">
            Across 4 monitored regional healthcare facilities.
          </p>
        </div>
      </div>

      {/* Interactive Bar Chart */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Days Left Before Stock-Out (Lowest Days First)
            </h3>
            <p className="text-xs text-slate-500">
              Color coded by risk tier (Rose &lt; 3d, Orange &lt; 7d, Yellow ≤ 14d)
            </p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} interval={0} angle={-15} textAnchor="end" height={45} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} label={{ value: "Days", angle: -90, position: "insideLeft", fontSize: 11, fill: "#94a3b8" }} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg">
                      <p className="font-bold text-slate-900">{d.medicine}</p>
                      <p className="text-[11px] text-slate-500">{d.hospital}</p>
                      <div className="mt-1 flex items-center justify-between gap-4 font-semibold">
                        <span className="text-slate-600">Stock covers:</span>
                        <span className="text-rose-600 font-bold">{d.days} days</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-slate-500 text-[11px]">
                        <span>Supplier Lead Time:</span>
                        <span>{d.leadTime} days</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="days" radius={[4, 4, 0, 0]}>
              {chartData.map((c) => (
                <Cell key={c.name} fill={BAR_COLORS[c.level] ?? "#64748b"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Interactive Filter Pills & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1 text-xs">
          <button
            onClick={() => setFeasibilityFilter("all")}
            className={`rounded-md px-3 py-1 font-semibold transition-colors ${
              feasibilityFilter === "all" ? "bg-indigo-600 text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All At-Risk ({allAtRisk.length})
          </button>
          <button
            onClick={() => setFeasibilityFilter("breached")}
            className={`rounded-md px-3 py-1 font-semibold transition-colors ${
              feasibilityFilter === "breached" ? "bg-rose-600 text-white" : "text-rose-700 hover:bg-rose-50"
            }`}
          >
            🚨 Must Redistribute ({breachedCount})
          </button>
          <button
            onClick={() => setFeasibilityFilter("safe")}
            className={`rounded-md px-3 py-1 font-semibold transition-colors ${
              feasibilityFilter === "safe" ? "bg-emerald-600 text-white" : "text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            Procurement OK ({safeCount})
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search shortage..."
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

      {/* Detailed Shortage Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredItems.map((r) => {
          const level = riskOf(r.days_left);
          const daysLeft = r.days_left ?? 0;
          const leadTime = r.supplier_lead_time_days;
          const covered = daysLeft > leadTime;
          const deficit = Math.max(0, leadTime - daysLeft);

          return (
            <div
              key={`${r.hospital_id}-${r.medicine_id}`}
              className={`rounded-2xl border p-5 shadow-sm transition-all duration-200 hover:shadow-md ${
                !covered
                  ? "border-rose-200 bg-gradient-to-br from-white via-rose-50/20 to-rose-50/40 hover:border-rose-300"
                  : "border-slate-200 bg-white hover:border-indigo-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{r.hospital}</h3>
                  </div>
                  <p className="text-xs font-semibold text-indigo-600 mt-0.5">{r.medicine}</p>
                </div>
                <RiskBadge level={level} size="md" />
              </div>

              {/* Visual Lead Time vs Stock Coverage Progress Bar */}
              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-500">Stock Run-Out Timeline</span>
                  <span className={`font-bold ${!covered ? "text-rose-600" : "text-emerald-700"}`}>
                    {daysLeft.toFixed(1)} days remaining
                  </span>
                </div>

                <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${!covered ? "bg-rose-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.min(100, Math.max(8, (daysLeft / 14) * 100))}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                  <span>Supplier Lead Time: <strong>{leadTime} days</strong></span>
                  {!covered ? (
                    <span className="font-bold text-rose-700">Deficit: -{deficit.toFixed(1)} days</span>
                  ) : (
                    <span className="font-bold text-emerald-700">Safety Buffer: +{(daysLeft - leadTime).toFixed(1)} days</span>
                  )}
                </div>
              </div>

              {/* Stock and Demand Stat Breakdown */}
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-slate-50 p-2">
                  <dt className="text-[11px] text-slate-500 font-medium">Available Units</dt>
                  <dd className="font-bold text-slate-900 mt-0.5">{r.current_quantity.toLocaleString()}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <dt className="text-[11px] text-slate-500 font-medium">Daily Burn Rate</dt>
                  <dd className="font-bold text-slate-900 mt-0.5">{r.avg_daily_usage.toFixed(1)} / day</dd>
                </div>
              </dl>

              {/* Action Banner */}
              <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <p className={`text-xs font-semibold ${covered ? "text-emerald-800" : "text-rose-800"}`}>
                  {covered
                    ? "Routine procurement will arrive before stockout."
                    : "Immediate peer redistribution required."}
                </p>

                {!covered ? (
                  <Link
                    to="/redistribution"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-rose-600/20 hover:bg-rose-700 transition-colors"
                  >
                    <Truck className="h-3.5 w-3.5" />
                    <span>Redistribute</span>
                  </Link>
                ) : (
                  <button
                    onClick={() => showToast(`Simulated PO expedited for ${r.supplier}.`)}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <span>Expedite PO</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
