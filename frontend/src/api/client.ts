/** Shared frontend view-model types for inventory/risk rendering.
 *
 * Live data is fetched through `api/medpredict.ts` (dataset-backed). This module
 * only holds the shared row shape and the risk-band helper used by every page.
 */

/** One row of the inventory view (API fields mapped by `api/medpredict.ts`). */
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

export type RiskLevel = "Critical" | "High" | "Medium" | "Safe";

/** Risk bands (exact, used everywhere — Issue #32 spec). */
export function riskOf(daysLeft: number | null | undefined): RiskLevel {
  if (daysLeft == null || Number.isNaN(daysLeft)) return "Safe";
  if (daysLeft < 3) return "Critical";
  if (daysLeft < 7) return "High";
  if (daysLeft <= 14) return "Medium";
  return "Safe";
}
