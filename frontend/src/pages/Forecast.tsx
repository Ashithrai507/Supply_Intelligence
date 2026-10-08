import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  Flame,
  LineChart as LineChartIcon,
  Pill,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  api,
  demoState,
  type ForecastRow,
  type ForecastSeries,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import DemoBadge from "../components/DemoBadge";

const CONFIDENCE_STYLES: Record<ForecastRow["confidence"], { bg: string; text: string; border: string }> = {
  high: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  medium: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  low: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
};

interface ChartPoint {
  date: string;
  actual?: number;
  predicted?: number;
}

export default function Forecast() {
  const { user } = useAuth();
  const currentHospitalId = user?.id ?? "h1";
  const currentHospitalName = user?.name ?? "City General Hospital";

  const [rows, setRows] = useState<ForecastRow[]>([]);
  const [series, setSeries] = useState<ForecastSeries | null>(null);
  const [hospitalId, setHospitalId] = useState(currentHospitalId);
  const [medicineId, setMedicineId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  // Interactive Outbreak Scenario Simulator (1.0 = Normal, up to 1.5 = +50% outbreak)
  const [surgeMultiplier, setSurgeMultiplier] = useState<number>(1.0);
  const [viewMode, setViewMode] = useState<"all" | "forecast" | "history">("all");

  useEffect(() => {
    api
      .getForecast()
      .then((data) => {
        setRows(data);
        setIsDemo(demoState.active);
        if (data.length > 0) {
          const matched = data.filter((r) => r.hospital_id === currentHospitalId);
          const first = matched.length > 0 ? matched[0] : data[0];
          setHospitalId(first.hospital_id);
          setMedicineId(first.medicine_id);
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [currentHospitalId]);

  useEffect(() => {
    if (!hospitalId || !medicineId) return;
    api
      .getForecastSeries(hospitalId, medicineId)
      .then(setSeries)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [hospitalId, medicineId]);


  const medicines = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows.filter((r) => !hospitalId || r.hospital_id === hospitalId))
      seen.set(r.medicine_id, r.medicine_name);
    return [...seen.entries()];
  }, [rows, hospitalId]);

  const current: ForecastRow | undefined = rows.find(
    (r) => r.hospital_id === hospitalId && r.medicine_id === medicineId,
  );

  // Dynamically reactive chart data scaled by scenario multiplier
  const chartData: ChartPoint[] = useMemo(() => {
    if (!series) return [];
    const history =
      viewMode === "forecast"
        ? []
        : series.history.map((h) => ({ date: h.date, actual: h.quantity_used }));

    const forecast =
      viewMode === "history"
        ? []
        : series.forecast.map((f) => ({
            date: f.date,
            predicted: Math.round(f.predicted_daily * surgeMultiplier),
          }));

    return [...history, ...forecast];
  }, [series, surgeMultiplier, viewMode]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm font-semibold">Running predictive neural forecasting models…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6 text-rose-900 shadow-sm">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-rose-600" />
          <div>
            <h3 className="font-bold">Could not load forecast intelligence</h3>
            <p className="text-xs text-rose-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-600">
        No forecast data currently generated.
      </div>
    );
  }

  // Reactive metrics adjusted for surge
  const effectiveDaily = current ? Math.round(current.predicted_daily_demand * surgeMultiplier * 10) / 10 : 0;
  const effectiveWeekly = current ? Math.round(current.predicted_weekly_demand * surgeMultiplier) : 0;
  const isSurgeActive = surgeMultiplier > 1.0;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              AI Demand Forecasting & Outbreak Projections
            </h1>
            {isDemo && <DemoBadge />}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Predictive consumption trajectories, epidemiological surge multipliers, and confidence scoring.
          </p>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-indigo-600" />
              <span>Facility Scope</span>
            </label>
            <div className="w-full rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs font-bold text-indigo-900 truncate">
              {currentHospitalName} ({user?.code})
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
              <Pill className="h-3.5 w-3.5 text-cyan-600" />
              <span>Select Medicine</span>
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none transition-colors"
              value={medicineId}
              onChange={(e) => setMedicineId(e.target.value)}
            >
              {medicines.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>

          {/* Interactive Surge Scenario Simulation Slider */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-950 mb-1.5">
              <span className="flex items-center gap-1 text-[11px]">
                <Flame className="h-3.5 w-3.5 text-rose-500" />
                <span>Simulate Surge / Outbreak:</span>
              </span>
              <span className={`rounded-md px-1.5 py-0.2 text-[11px] font-bold ${isSurgeActive ? "bg-rose-600 text-white" : "bg-indigo-100 text-indigo-700"}`}>
                +{Math.round((surgeMultiplier - 1) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="1.0"
              max="1.5"
              step="0.05"
              value={surgeMultiplier}
              onChange={(e) => setSurgeMultiplier(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer h-1.5"
            />
            <div className="flex justify-between text-[10px] text-indigo-700/80 font-medium mt-1">
              <span>Baseline (1.0x)</span>
              <span>Mild (+25%)</span>
              <span>Severe Outbreak (+50%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reactive Metric Cards */}
      {current && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Daily Projected */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm hover:border-indigo-200 transition-all">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Predicted Daily</span>
              <div className="rounded-lg bg-indigo-100 p-1.5 text-indigo-600">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-slate-900">
              {effectiveDaily.toFixed(1)} <span className="text-xs font-semibold text-slate-400">units/day</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Baseline: {current.baseline_daily_demand.toFixed(1)} units
            </p>
          </div>

          {/* Weekly Projected */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm hover:border-indigo-200 transition-all">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>7-Day Requirement</span>
              <div className="rounded-lg bg-cyan-100 p-1.5 text-cyan-600">
                <Calendar className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-slate-900">
              {effectiveWeekly.toLocaleString()} <span className="text-xs font-semibold text-slate-400">units/week</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Estimated 14-day: {(effectiveWeekly * 2).toLocaleString()} units
            </p>
          </div>

          {/* Trend & Growth Velocity */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm hover:border-indigo-200 transition-all">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Demand Growth Trend</span>
              <div className="rounded-lg bg-purple-100 p-1.5 text-purple-600">
                <Zap className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">
                {current.trend_growth_pct >= 0 ? "+" : ""}{current.trend_growth_pct.toFixed(1)}%
              </span>
              {current.trend_growth_pct > 20 && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                  Surge Alert
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Based on rolling historical gradient
            </p>
          </div>

          {/* Confidence Score */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm hover:border-indigo-200 transition-all">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <span>Model Confidence</span>
              <div className="rounded-lg bg-emerald-100 p-1.5 text-emerald-600">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`inline-block rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${CONFIDENCE_STYLES[current.confidence].bg} ${CONFIDENCE_STYLES[current.confidence].text} ${CONFIDENCE_STYLES[current.confidence].border}`}
              >
                {current.confidence} Confidence
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Validated on 30-day clinical log volume
            </p>
          </div>
        </div>
      )}

      {/* Main Chart Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <LineChartIcon className="h-4 w-4 text-indigo-600" />
              <span>Historical Consumption vs AI Projected Demand</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              30-day actual clinical consumption history + 14-day predictive horizon
            </p>
          </div>

          {/* View Mode Filter Tabs */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              onClick={() => setViewMode("all")}
              className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                viewMode === "all" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Full Series
            </button>
            <button
              onClick={() => setViewMode("forecast")}
              className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                viewMode === "forecast" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Forecast Only
            </button>
            <button
              onClick={() => setViewMode("history")}
              className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                viewMode === "history" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              History Only
            </button>
          </div>
        </div>

        {chartData.length === 0 ? (
          <p className="py-12 text-center text-xs text-slate-500">No series data available for this selection.</p>
        ) : (
          <div className="pt-2">
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={chartData} margin={{ top: 10, right: 15, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur-md">
                          <p className="font-bold text-slate-800 mb-1">{label}</p>
                          {payload.map((entry) => (
                            <div key={entry.name} className="flex items-center gap-2 py-0.5">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: entry.color }}
                              />
                              <span className="font-medium text-slate-600">{entry.name}:</span>
                              <span className="font-bold text-slate-900">{Number(entry.value).toLocaleString()} units</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: 12, fontSize: 12, fontWeight: 500 }}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Historical Dispensed"
                  stroke="#334155"
                  strokeWidth={2.5}
                  dot={{ r: 2, fill: "#334155" }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  name={isSurgeActive ? `AI Projection (+${Math.round((surgeMultiplier - 1) * 100)}% Surge)` : "AI Projected Demand"}
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                  dot={{ r: 2, fill: "#4f46e5" }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
