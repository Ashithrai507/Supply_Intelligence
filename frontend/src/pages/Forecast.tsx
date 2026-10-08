import { useEffect, useMemo, useState } from "react";
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
import DemoBadge from "../components/DemoBadge";
import { useHospital } from "../context/HospitalContext";

const CONFIDENCE_STYLES: Record<ForecastRow["confidence"], string> = {
  high: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  medium: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20",
  low: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20",
};

interface ChartPoint {
  date: string;
  actual?: number;
  predicted?: number;
}

export default function Forecast() {
  const { activeHospitalId, isNetworkView } = useHospital();

  const [rows, setRows] = useState<ForecastRow[]>([]);
  const [series, setSeries] = useState<ForecastSeries | null>(null);
  const [hospitalId, setHospitalId] = useState("");
  const [medicineId, setMedicineId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    api
      .getForecast()
      .then((data) => {
        setRows(data);
        setIsDemo(demoState.active);
        if (data.length > 0) {
          // Default to current active hospital account context if valid
          const targetHid = (!isNetworkView && activeHospitalId) ? activeHospitalId : data[0].hospital_id;
          const targetRow = data.find((r) => r.hospital_id === targetHid) ?? data[0];
          setHospitalId(targetRow.hospital_id);
          setMedicineId(targetRow.medicine_id);
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  // Update hospital selection when global account switcher changes
  useEffect(() => {
    if (!isNetworkView && activeHospitalId) {
      setHospitalId(activeHospitalId);
      const match = rows.find((r) => r.hospital_id === activeHospitalId);
      if (match) setMedicineId(match.medicine_id);
    }
  }, [activeHospitalId, isNetworkView, rows]);


  useEffect(() => {
    if (!hospitalId || !medicineId) return;
    api
      .getForecastSeries(hospitalId, medicineId)
      .then(setSeries)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [hospitalId, medicineId]);

  const hospitals = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) seen.set(r.hospital_id, r.hospital_name);
    return [...seen.entries()];
  }, [rows]);

  const medicines = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows.filter((r) => !hospitalId || r.hospital_id === hospitalId))
      seen.set(r.medicine_id, r.medicine_name);
    return [...seen.entries()];
  }, [rows, hospitalId]);

  const current: ForecastRow | undefined = rows.find(
    (r) => r.hospital_id === hospitalId && r.medicine_id === medicineId,
  );

  const chartData: ChartPoint[] = useMemo(() => {
    if (!series) return [];
    const history = series.history.map((h) => ({ date: h.date, actual: h.quantity_used }));
    const forecast = series.forecast.map((f) => ({ date: f.date, predicted: f.predicted_daily }));
    return [...history, ...forecast];
  }, [series]);

  if (loading) return <p className="text-slate-600 p-8 text-center">Loading demand forecasts…</p>;
  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800 shadow-xs">
        <p className="font-semibold text-lg">Could not load forecasts.</p>
        <p className="mt-1 text-sm">{error} — is the backend running on the configured API base URL?</p>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center text-slate-500 shadow-xs">
        No forecast data available.
      </div>
    );
  }

  const selectCls = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none shadow-2xs";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-['Outfit',sans-serif] text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          Demand Forecasting Engine {isDemo && <DemoBadge />}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Multi-horizon quantile forecasting (LightGBM) with 30-day historical consumption & 14-day projections
        </p>
      </div>

      {/* Selectors Bar */}
      <div className="flex flex-wrap gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <span>Select Hospital:</span>
          <select
            className={selectCls}
            value={hospitalId}
            onChange={(e) => {
              setHospitalId(e.target.value);
              setMedicineId("");
            }}
          >
            {hospitals.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <span>Select Medicine:</span>
          <select
            className={selectCls}
            value={medicineId}
            onChange={(e) => setMedicineId(e.target.value)}
          >
            {medicines.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Metric Cards */}
      {current && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Predicted Daily Demand</p>
            <p className="mt-1 font-['Outfit',sans-serif] text-2xl font-bold text-slate-900">
              {current.predicted_daily_demand.toFixed(1)} <span className="text-xs font-normal text-slate-500">units/day</span>
            </p>
            <p className="mt-1 text-[11px] text-slate-500">Baseline: {current.baseline_daily_demand.toFixed(0)} units</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">7-Day Weekly Total</p>
            <p className="mt-1 font-['Outfit',sans-serif] text-2xl font-bold text-slate-900">
              {current.predicted_weekly_demand.toFixed(0)} <span className="text-xs font-normal text-slate-500">units/wk</span>
            </p>
            <p className="mt-1 text-[11px] text-slate-500">Outbreak Multiplier: {current.outbreak_multiplier}x</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Trend Growth</p>
            <p className={`mt-1 font-['Outfit',sans-serif] text-2xl font-bold ${current.trend_growth_pct >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {current.trend_growth_pct >= 0 ? "+" : ""}{current.trend_growth_pct.toFixed(1)}%
            </p>
            <p className="mt-1 text-[11px] text-slate-500">Versus 30-day baseline</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Model Confidence</p>
            <div className="mt-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${CONFIDENCE_STYLES[current.confidence]}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {current.confidence} Confidence
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Chart Box */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-['Outfit',sans-serif] text-base font-bold text-slate-900">
              Demand Consumption Trajectory & Forecast
            </h3>
            <p className="text-xs text-slate-500">30 days of actual historical usage (solid dark) vs 14-day projection (dashed indigo)</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-slate-900 inline-block" /> Actual</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-indigo-600 inline-block" /> Forecast</span>
          </div>
        </div>

        {chartData.length === 0 ? (
          <p className="text-xs text-slate-500 p-8 text-center">No series data for this selection.</p>
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} minTickGap={24} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  borderRadius: "12px",
                  borderColor: "#e2e8f0",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ paddingTop: "12px", fontSize: "12px" }} />
              <Line
                type="monotone"
                dataKey="actual"
                name="Actual Quantity Used"
                stroke="#0f172a"
                strokeWidth={2.5}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="predicted"
                name="Forecast Demand"
                stroke="#4f46e5"
                strokeWidth={2.5}
                strokeDasharray="6 4"
                dot={{ r: 3, fill: "#4f46e5" }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

