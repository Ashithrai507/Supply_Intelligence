/** Demand Forecast page — real LightGBM pipeline showcase (task §4–§15).
 *
 * Data flow (all real API, typed in ../api/forecast):
 *   historical demand → LightGBM forecast → inventory projection → risk → action
 * No fake values: without the backend this page shows loading / error / empty
 * states (§20–§22). Set VITE_USE_MOCK=true only for offline UI development;
 * mock output is then explicitly labeled and never presented as model output.
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  FlaskConical,
  LineChart as LineChartIcon,
  Loader2,
  Pill,
  RefreshCw,
  ShoppingCart,
  Truck,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatShortDate,
  getForecast,
  getHospitals,
  getInventoryOutlook,
  getMedicines,
  getProcurementRecommendation,
  runDemandScenario,
  type ForecastResponse,
  type HospitalOption,
  type InventoryOutlook,
  type MedicineOption,
  type ProcurementRecommendation,
  type ScenarioResponse,
} from "../api/forecast";

const USE_MOCK = (import.meta.env.VITE_USE_MOCK as string | undefined) === "true";

const HORIZONS = [7, 14, 30];
const SURGE_OPTIONS = [0, 20, 40, 60];

const RISK_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800 border-red-300",
  HIGH: "bg-orange-100 text-orange-800 border-orange-300",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-300",
  LOW: "bg-green-100 text-green-800 border-green-300",
};

interface ChartPoint {
  date: string;
  label: string;
  actual?: number;
  predicted?: number;
}

function riskMessage(med: string, outlook: InventoryOutlook): string {
  if (outlook.days_until_stockout == null) {
    return `${med} has enough usable stock for the forecast horizon at current demand.`;
  }
  const date = outlook.projected_stockout_date ?? "an unknown date";
  return (
    `Based on forecast demand and current inventory, ${med} is projected ` +
    `to fall below safety stock in ${outlook.days_until_stockout} days ` +
    `(${date}). Risk level: ${outlook.risk_level}.`
  );
}

const cardCls = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm";
const labelCls = "text-xs font-medium uppercase tracking-wide text-slate-500";

export default function Forecast() {
  const [searchParams] = useSearchParams();
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [medicines, setMedicines] = useState<MedicineOption[]>([]);
  const [hospitalId, setHospitalId] = useState("");
  const [medicineId, setMedicineId] = useState("");
  const [horizon, setHorizon] = useState(7);

  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [outlook, setOutlook] = useState<InventoryOutlook | null>(null);
  const [recommendation, setRecommendation] = useState<ProcurementRecommendation | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [surgePct, setSurgePct] = useState(40);
  const [scenario, setScenario] = useState<ScenarioResponse | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  // Catalog for selectors.
  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([getHospitals(ctrl.signal), getMedicines(ctrl.signal)])
      .then(([h, m]) => {
        setHospitals(h);
        setMedicines(m);
        // Deep links (§17): /forecast?hospital=H01&medicine=M001 wins over defaults.
        const paramH = searchParams.get("hospital");
        const paramM = searchParams.get("medicine");
        if (h.length > 0) {
          setHospitalId((prev) => prev || (paramH && h.some((x) => x.id === paramH) ? paramH : h[0].id));
        }
        if (m.length > 0) {
          setMedicineId((prev) => prev || (paramM && m.some((x) => x.id === paramM) ? paramM : m[0].id));
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => ctrl.abort();
  }, []);

  // Forecast + inventory + procurement for the selection.
  useEffect(() => {
    if (!hospitalId || !medicineId) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    setScenario(null);
    Promise.all([
      getForecast(hospitalId, medicineId, horizon, ctrl.signal),
      getInventoryOutlook(hospitalId, medicineId, ctrl.signal),
      getProcurementRecommendation(hospitalId, medicineId, ctrl.signal),
    ])
      .then(([fc, inv, rec]) => {
        setForecast(fc);
        setOutlook(inv);
        setRecommendation(rec);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [hospitalId, medicineId, horizon, reloadKey]);

  const chartData: ChartPoint[] = useMemo(() => {
    if (!forecast) return [];
    const hist = forecast.historical.map((h) => ({
      date: h.date,
      label: formatShortDate(h.date),
      actual: h.predicted_demand,
    }));
    const fc = forecast.forecast.map((f) => ({
      date: f.date,
      label: formatShortDate(f.date),
      predicted: f.predicted_demand,
    }));
    return [...hist, ...fc];
  }, [forecast]);

  const todayLabel = useMemo(() => {
    if (!forecast || forecast.historical.length === 0) return "";
    return formatShortDate(forecast.historical[forecast.historical.length - 1].date);
  }, [forecast]);

  /** Projected inventory walk: usable stock minus cumulative forecast demand. */
  const projection = useMemo(() => {
    if (!forecast || !outlook) return [];
    const safetyBuffer = outlook.expected_daily_demand * 2;
    let stock = outlook.usable_inventory;
    return forecast.forecast.map((f) => {
      stock = Math.max(0, stock - f.predicted_demand);
      return { date: f.date, label: formatShortDate(f.date), stock: Math.round(stock), safety: Math.round(safetyBuffer) };
    });
  }, [forecast, outlook]);

  function runScenario() {
    if (!hospitalId || !medicineId) return;
    setScenarioLoading(true);
    setScenarioError(null);
    runDemandScenario(hospitalId, medicineId, surgePct)
      .then(setScenario)
      .catch((err: unknown) => setScenarioError(err instanceof Error ? err.message : String(err)))
      .finally(() => setScenarioLoading(false));
  }

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-600">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p>Generating demand forecast…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-center">
        <p className="font-semibold text-red-800">Unable to load forecast.</p>
        <p className="mt-1 text-sm text-red-700">{error} — is the backend running?</p>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="mt-3 inline-flex items-center gap-1 rounded bg-red-700 px-3 py-1 text-sm font-semibold text-white hover:bg-red-800"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (!forecast || !outlook || forecast.forecast.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-600">
        Insufficient historical demand data to generate a reliable forecast.
      </div>
    );
  }

  const metrics = forecast.metrics ?? {};
  const baseline = forecast.baseline_metrics ?? {};
  const hasMetrics = metrics.mae != null && metrics.rmse != null && metrics.wape != null;
  const riskCls = RISK_STYLES[outlook.risk_level] ?? RISK_STYLES.MEDIUM;

  return (
    <div className="space-y-4">
      {/* Header + selectors */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Demand Forecast</h2>
          <p className="text-sm text-slate-500">AI-powered medicine demand prediction</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Hospital"
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            value={hospitalId}
            onChange={(e) => setHospitalId(e.target.value)}
          >
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
          <select
            aria-label="Medicine"
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            value={medicineId}
            onChange={(e) => setMedicineId(e.target.value)}
          >
            {medicines.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <select
            aria-label="Forecast horizon"
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
          >
            {HORIZONS.map((h) => (
              <option key={h} value={h}>{h} days</option>
            ))}
          </select>
        </div>
      </div>
      {USE_MOCK && (
        <p className="rounded border border-amber-300 bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
          Demo data — not model output (VITE_USE_MOCK is on)
        </p>
      )}

      {/* Hero card */}
      <div className={cardCls}>
        <div className="flex items-center gap-2">
          <Pill className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-bold">{outlook.medicine_name}</h3>
          <span className="text-xs text-slate-500">{outlook.category} · {outlook.criticality_level}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div><p className={labelCls}>Current stock</p><p className="text-lg font-bold">{outlook.usable_inventory.toLocaleString()} {outlook.unit}</p></div>
          <div><p className={labelCls}>Avg daily demand</p><p className="text-lg font-bold">{outlook.expected_daily_demand.toFixed(1)}</p></div>
          <div><p className={labelCls}>Days of supply</p><p className="text-lg font-bold">{outlook.days_of_supply.toFixed(1)} days</p></div>
          <div><p className={labelCls}>Forecast horizon</p><p className="text-lg font-bold">{forecast.horizon_days} days</p></div>
          <div><p className={labelCls}>Model</p><p className="text-lg font-bold">{forecast.model}</p></div>
        </div>
      </div>

      {/* Main chart */}
      <div className={cardCls}>
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold">
          <LineChartIcon className="h-4 w-4 text-indigo-600" /> Historical vs forecast demand
        </h3>
        <p className="mb-2 text-xs text-slate-500">Solid = actual consumption · Dashed = LightGBM prediction</p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={28} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <ReferenceLine x={todayLabel} stroke="#64748b" strokeDasharray="4 3" label={{ value: "TODAY", fontSize: 11, fill: "#64748b" }} />
            <Line type="monotone" dataKey="actual" name="Actual used" stroke="#1f2937" strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="predicted" name="Forecast" stroke="#4f46e5" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Forecast table + inventory outlook */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cardCls}>
          <h3 className="mb-2 text-sm font-bold">Forecast table</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Date</th><th className="py-1 text-right">Predicted demand</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {forecast.forecast.map((f) => (
                <tr key={f.date}><td className="py-1">{formatShortDate(f.date)}</td><td className="py-1 text-right font-medium">{f.predicted_demand.toFixed(1)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={`${cardCls} space-y-4`}>
          <div>
            <h3 className="mb-2 text-sm font-bold">Inventory outlook</h3>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-slate-500">Current stock</dt><dd className="text-right font-semibold">{outlook.usable_inventory.toLocaleString()} {outlook.unit}</dd>
              <dt className="text-slate-500">Projected stock-out</dt><dd className="text-right font-semibold">{outlook.projected_stockout_date ?? "—"}</dd>
              <dt className="text-slate-500">Days until stock-out</dt><dd className="text-right font-semibold">{outlook.days_until_stockout ?? "—"}</dd>
              <dt className="text-slate-500">Lead time</dt><dd className="text-right font-semibold">{outlook.supplier_lead_time_days} days</dd>
            </dl>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold">Projected inventory</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={projection} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={30} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="stock" name="Projected stock" stroke="#059669" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="safety" name="2-day safety buffer" stroke="#dc2626" strokeWidth={1} strokeDasharray="4 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className={`rounded-lg border px-3 py-2 ${riskCls}`}>
            <p className="flex items-center gap-1 text-sm font-bold"><AlertTriangle className="h-4 w-4" /> {outlook.risk_level} STOCK-OUT RISK</p>
            <p className="mt-1 text-xs">{riskMessage(outlook.medicine_name, outlook)}</p>
          </div>
        </div>
      </div>

      {/* Procurement recommendation */}
      <div className={cardCls}>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><ShoppingCart className="h-4 w-4 text-indigo-600" /> Recommended action</h3>
        {recommendation ? (
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><p className={labelCls}>Medicine</p><p className="font-semibold">{recommendation.medicine_name}</p></div>
            <div><p className={labelCls}>Recommended order</p><p className="font-semibold">{recommendation.recommended_quantity.toLocaleString()} units</p></div>
            <div><p className={labelCls}>Supplier</p><p className="font-semibold">{recommendation.source_name}</p></div>
            <div><p className={labelCls}>Expected delivery</p><p className="font-semibold">{recommendation.expected_delivery_date} ({recommendation.lead_time_days} days)</p></div>
            <p className="text-xs text-slate-600 sm:col-span-2 lg:col-span-4">Reason: {recommendation.reason}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No order needed — usable stock covers lead-time demand plus safety buffer.</p>
        )}
      </div>

      {/* Scenario runner */}
      <div className={cardCls}>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><FlaskConical className="h-4 w-4 text-indigo-600" /> Demand surge scenario</h3>
        <div className="flex flex-wrap items-center gap-2">
          {SURGE_OPTIONS.map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => setSurgePct(pct)}
              className={`rounded px-3 py-1 text-sm font-semibold ${surgePct === pct ? "bg-slate-900 text-white" : "border border-slate-300 hover:bg-slate-100"}`}
            >
              +{pct}%
            </button>
          ))}
          <button
            type="button"
            onClick={runScenario}
            disabled={scenarioLoading}
            className="rounded bg-indigo-600 px-3 py-1 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {scenarioLoading ? "Running…" : "Run Scenario"}
          </button>
        </div>
        {scenarioError && <p className="mt-2 text-sm text-red-700">{scenarioError}</p>}
        {scenario && (
          <div className="mt-3">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Stock-out", before: scenario.baseline_stockout_date ?? "—", after: scenario.simulated_stockout_date ?? "—" },
                { label: "Risk", before: scenario.baseline_risk_level, after: scenario.simulated_risk_level },
                {
                  label: "Recommended order",
                  before: `${scenario.baseline_recommended_order.toLocaleString()} units`,
                  after: `${scenario.simulated_recommended_order.toLocaleString()} units`,
                },
              ].map((c) => (
                <div key={c.label} className="rounded-lg border border-slate-200 p-3">
                  <p className={labelCls}>{c.label}</p>
                  <p className="mt-1 text-sm"><span className="text-slate-500">Before:</span> <strong>{c.before}</strong></p>
                  <p className="text-sm"><span className="text-slate-500">After +{scenario.demand_increase_pct}%:</span> <strong className="text-indigo-700">{c.after}</strong></p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-600"><Truck className="mr-1 inline h-3 w-3" />{scenario.summary}</p>
          </div>
        )}
      </div>

      {/* Model info + performance */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cardCls}>
          <h3 className="mb-2 text-sm font-bold">AI forecasting model</h3>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-slate-500">Model</dt><dd className="text-right font-semibold">{forecast.model}</dd>
            <dt className="text-slate-500">Version</dt><dd className="text-right font-semibold">{forecast.model_version}</dd>
            <dt className="text-slate-500">Target</dt><dd className="text-right font-semibold">Daily medicine consumption</dd>
            <dt className="text-slate-500">Forecast horizon</dt><dd className="text-right font-semibold">{forecast.horizon_days} days</dd>
          </dl>
        </div>
        <div className={cardCls}>
          <h3 className="mb-2 text-sm font-bold">Model performance</h3>
          {hasMetrics ? (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500"><th></th><th className="text-right">LightGBM</th><th className="text-right">Baseline (7-day MA)</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                <tr><td>MAE</td><td className="text-right font-medium">{metrics.mae?.toFixed(2)}</td><td className="text-right">{baseline.mae?.toFixed(2) ?? "—"}</td></tr>
                <tr><td>RMSE</td><td className="text-right font-medium">{metrics.rmse?.toFixed(2)}</td><td className="text-right">{baseline.rmse?.toFixed(2) ?? "—"}</td></tr>
                <tr><td>WAPE</td><td className="text-right font-medium">{((metrics.wape ?? 0) * 100).toFixed(2)}%</td><td className="text-right">{baseline.wape != null ? `${(baseline.wape * 100).toFixed(2)}%` : "—"}</td></tr>
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-slate-500">Metrics not returned by the backend.</p>
          )}
        </div>
      </div>
    </div>
  );
}
