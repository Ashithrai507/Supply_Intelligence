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

export const api = {
  getInventory: () => get<InventoryRow[]>("/inventory"),
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
