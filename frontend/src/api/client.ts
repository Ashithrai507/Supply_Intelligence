/** Typed API client for the Phase 1 relaunch backend (plain REST, no auth).
 * Base URL: VITE_API_BASE_URL (default http://localhost:8000).
 * Contract: Phase 1 T4 (#31) — GET /hospitals, /medicines, /inventory, /demand-history.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

/** One row of GET /inventory: per hospital×medicine view (T4 spec). */
export interface InventoryRow {
  hospital_id: string;
  hospital: string;
  medicine_id: string;
  medicine: string;
  current_quantity: number;
  avg_daily_usage: number;
  days_left: number | null;
  supplier: string;
  supplier_lead_time_days: number;
  expiry_date: string; // ISO date
  criticality: string; // "critical" for critical supplies
  alternative_available: boolean;
}

/** One row of GET /forecast (T6 spec). */
export interface ForecastRow {
  hospital_id: string;
  hospital_name: string;
  medicine_id: string;
  medicine_name: string;
  baseline_daily_demand: number;
  predicted_daily_demand: number;
  predicted_weekly_demand: number;
  trend_growth_pct: number;
  outbreak_multiplier: number;
  confidence: "high" | "medium" | "low";
}

export interface HistoryPoint {
  date: string;
  quantity_used: number;
}

export interface ForecastPoint {
  date: string;
  predicted_daily: number;
}

/** GET /forecast/series (T6 spec): last 30 history + next 14 forecast points. */
export interface ForecastSeries {
  history: HistoryPoint[];
  forecast: ForecastPoint[];
}

export const api = {
  getInventory: () => get<InventoryRow[]>("/inventory"),
  getForecast: (hospitalId?: string, medicineId?: string) => {
    const params = new URLSearchParams();
    if (hospitalId) params.set("hospital_id", hospitalId);
    if (medicineId) params.set("medicine_id", medicineId);
    const qs = params.toString();
    return get<ForecastRow[]>(`/forecast${qs ? `?${qs}` : ""}`);
  },
  getForecastSeries: (hospitalId: string, medicineId: string) =>
    get<ForecastSeries>(
      `/forecast/series?hospital_id=${encodeURIComponent(hospitalId)}&medicine_id=${encodeURIComponent(medicineId)}`,
    ),
};

export type RiskLevel = "Critical" | "High" | "Medium" | "Safe";

/** Risk bands (exact, used everywhere — Issue #32 spec). */
export function riskOf(daysLeft: number | null | undefined): RiskLevel {
  if (daysLeft == null || Number.isNaN(daysLeft)) return "Safe";
  if (daysLeft < 3) return "Critical";
  if (daysLeft < 7) return "High";
  if (daysLeft <= 14) return "Medium";
  return "Safe";
}
