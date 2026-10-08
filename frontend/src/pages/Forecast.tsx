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

const CONFIDENCE_STYLES: Record<ForecastRow["confidence"], string> = {
  high: "bg-green-100 text-green-800 border-green-300",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
  low: "bg-red-100 text-red-800 border-red-300",
};

interface ChartPoint {
  date: string;
  actual?: number;
  predicted?: number;
}

/** Forecast page (T6 frontend slice): selectors + history/forecast chart + stats.
 * Backend half of #33 (prediction math, GET /forecast, /forecast/series) lands separately. */
export default function Forecast() {
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
          const first = data[0];
          setHospitalId(first.hospital_id);
          setMedicineId(first.medicine_id);
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

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

  if (loading) return <p className="text-gray-600">Loading forecasts…</p>;
  if (error) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-4 text-red-800">
        <p className="font-semibold">Could not load forecasts.</p>
        <p className="text-sm">{error} — is the backend running on the configured API base URL?</p>
      </div>
    );
  }
  if (rows.length === 0) {
    return <p className="rounded border border-gray-200 bg-white p-6 text-center text-gray-600">No forecast data available.</p>;
  }

  const selectCls = "rounded border border-gray-300 px-2 py-1 text-sm";

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Demand Forecast {isDemo && <DemoBadge />}</h2>

      <div className="mb-4 flex flex-wrap gap-3 rounded border border-gray-200 bg-gray-50 p-3">
        <label className="flex items-center gap-1 text-sm">
          Hospital{" "}
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
        <label className="flex items-center gap-1 text-sm">
          Medicine{" "}
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

      {current && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border border-gray-200 bg-white p-3">
            <p className="text-xs uppercase text-gray-500">Predicted daily</p>
            <p className="text-lg font-semibold">{current.predicted_daily_demand.toFixed(1)} / day</p>
          </div>
          <div className="rounded border border-gray-200 bg-white p-3">
            <p className="text-xs uppercase text-gray-500">Predicted weekly</p>
            <p className="text-lg font-semibold">{current.predicted_weekly_demand.toFixed(0)} / week</p>
          </div>
          <div className="rounded border border-gray-200 bg-white p-3">
            <p className="text-xs uppercase text-gray-500">Demand growth</p>
            <p className="text-lg font-semibold">
              {current.trend_growth_pct >= 0 ? "+" : ""}{current.trend_growth_pct.toFixed(1)}%
            </p>
          </div>
          <div className="rounded border border-gray-200 bg-white p-3">
            <p className="text-xs uppercase text-gray-500">Confidence</p>
            <p className="mt-1">
              <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${CONFIDENCE_STYLES[current.confidence]}`}>
                {current.confidence}
              </span>
            </p>
          </div>
        </div>
      )}

      <div className="rounded border border-gray-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Actual demand (solid) vs forecast (dashed)</h3>
        {chartData.length === 0 ? (
          <p className="text-sm text-gray-500">No series data for this selection.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="actual" name="Actual used" stroke="#1f2937" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="predicted" name="Forecast" stroke="#2563eb" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
