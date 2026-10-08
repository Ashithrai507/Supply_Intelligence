/** Typed LightGBM forecast API layer (task §18–§19).
 *
 * All MedPredict backend communication for the forecast flow lives here —
 * components never call fetch() directly. Field names are mapped once, here,
 * so a backend rename touches one file. No `any` anywhere.
 *
 * Endpoints (backend/app/api):
 *   GET  /api/forecast/{hospital_id}/{medicine_id}?horizon_days&demand_surge_multiplier
 *   GET  /api/inventory/{hospital_id}/{medicine_id}
 *   GET  /api/procurement/recommendations?hospital_id&surge_multiplier
 *   POST /api/simulation/run  {hospital_id, medicine_id, demand_increase_pct}
 *   GET  /api/hospitals | GET /api/medicines | GET /api/dashboard?hospital_id
 */

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

/* ---------------- Types (§19) ---------------- */

export interface ForecastPoint {
  date: string;
  predicted_demand: number;
}

export interface ForecastMetrics {
  mae: number;
  rmse: number;
  wape: number;
}

export interface ForecastResponse {
  hospital_id: string;
  medicine_id: string;
  medicine_name: string | null;
  horizon_days: number;
  forecast: ForecastPoint[];
  historical: ForecastPoint[];
  model: string;
  model_version: string;
  metrics: Partial<ForecastMetrics>;
  baseline_metrics: Partial<ForecastMetrics>;
}

export interface InventoryBatch {
  batch_number: string;
  quantity: number;
  expiry_date: string;
  days_to_expiry: number;
  potential_wastage: number;
}

export interface InventoryOutlook {
  hospital_id: string;
  medicine_id: string;
  medicine_name: string;
  category: string;
  unit: string;
  criticality_level: string;
  total_quantity: number;
  usable_inventory: number;
  expected_daily_demand: number;
  days_of_supply: number;
  projected_stockout_date: string | null;
  days_until_stockout: number | null;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  supplier_lead_time_days: number;
  incoming_purchase_orders_quantity: number;
  batches: InventoryBatch[];
}

export interface RiskSummary {
  level: InventoryOutlook["risk_level"];
  days_until_stockout: number | null;
  projected_stockout_date: string | null;
  /** Dynamically generated from inventory + forecast numbers. */
  message: string;
}

export interface ProcurementRecommendation {
  medicine_id: string;
  medicine_name: string;
  recommended_quantity: number;
  source_name: string;
  lead_time_days: number;
  expected_delivery_date: string;
  urgency: string;
  reason: string;
}

export interface ScenarioResponse {
  baseline_stockout_date: string | null;
  baseline_days_until_stockout: number | null;
  baseline_risk_level: string;
  baseline_recommended_order: number;
  baseline_daily_demand: number;
  simulated_stockout_date: string | null;
  simulated_days_until_stockout: number | null;
  simulated_risk_level: string;
  simulated_recommended_order: number;
  simulated_daily_demand: number;
  demand_increase_pct: number;
  summary: string;
}

export interface HospitalOption {
  id: string;
  name: string;
}

export interface MedicineOption {
  id: string;
  name: string;
  category: string;
}

export interface DashboardAlert {
  medicine_id: string;
  medicine_name: string;
  days_until_stockout: number | null;
  risk_level: string;
}

/* ---------------- Functions (§18) ---------------- */

export function getForecast(
  hospitalId: string,
  medicineId: string,
  horizonDays = 7,
  signal?: AbortSignal,
): Promise<ForecastResponse> {
  return request<ForecastResponse>(
    `/api/forecast/${encodeURIComponent(hospitalId)}/${encodeURIComponent(medicineId)}?horizon_days=${horizonDays}`,
    { signal },
  );
}

export function getInventoryOutlook(
  hospitalId: string,
  medicineId: string,
  signal?: AbortSignal,
): Promise<InventoryOutlook> {
  return request<InventoryOutlook>(
    `/api/inventory/${encodeURIComponent(hospitalId)}/${encodeURIComponent(medicineId)}`,
    { signal },
  );
}

export function getProcurementRecommendation(
  hospitalId: string,
  medicineId: string,
  signal?: AbortSignal,
): Promise<ProcurementRecommendation | null> {
  return request<ProcurementRecommendation[]>(
    `/api/procurement/recommendations?hospital_id=${encodeURIComponent(hospitalId)}`,
    { signal },
  ).then((list) => list.find((r) => r.medicine_id === medicineId) ?? null);
}

export function runDemandScenario(
  hospitalId: string,
  medicineId: string,
  demandIncreasePct: number,
  signal?: AbortSignal,
): Promise<ScenarioResponse> {
  return request<ScenarioResponse>("/api/simulation/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hospital_id: hospitalId,
      medicine_id: medicineId,
      demand_increase_pct: demandIncreasePct,
    }),
    signal,
  });
}

export function getHospitals(signal?: AbortSignal): Promise<HospitalOption[]> {
  return request<HospitalOption[]>("/api/hospitals", { signal });
}

export function getMedicines(signal?: AbortSignal): Promise<MedicineOption[]> {
  return request<MedicineOption[]>("/api/medicines", { signal });
}

export function getDashboardAlerts(
  hospitalId: string,
  signal?: AbortSignal,
): Promise<DashboardAlert[]> {
  return request<{ critical_alerts: DashboardAlert[] }>(
    `/api/dashboard?hospital_id=${encodeURIComponent(hospitalId)}`,
    { signal },
  ).then((d) => d.critical_alerts);
}

/** Display helpers (pure formatting, no business logic). */
export function formatShortDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
