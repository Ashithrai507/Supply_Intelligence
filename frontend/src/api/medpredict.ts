/** Typed MedPredict API layer backed by the real dataset (`data/synthetic` → SQLite/Postgres).
 *
 * Single source of truth for every page that used to read the hardcoded
 * `mockData.ts` fixtures. Components never call fetch() directly; raw backend
 * field names are mapped to the row shapes the pages already render.
 *
 * Endpoints (backend/app/api):
 *   GET  /api/v1/inventory?hospital_id
 *   GET  /api/v1/risks/stockout?hospital_id
 *   GET  /api/v1/risks/expiry?hospital_id
 *   GET  /api/v1/procurement/recommendations?hospital_id
 *   GET  /api/v1/procurement/redistribution?hospital_id
 *   GET  /api/v1/dashboard?hospital_id
 *   GET  /api/hospitals | /api/medicines
 */

import { getHospitals, type HospitalOption } from "./forecast";
import { riskOf, type InventoryRow } from "./client";

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000";

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { signal });
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

/* ---------------- Raw backend types ---------------- */

export interface Hospital {
  id: string;
  name: string;
  city: string | null;
  bed_capacity: number;
  avg_daily_patients: number;
}

export interface Medicine {
  id: string;
  name: string;
  category: string;
  unit: string;
  criticality_level: string;
}

export interface InventoryBatch {
  id: string;
  batch_number: string;
  quantity: number;
  reserved_quantity: number;
  usable_quantity: number;
  received_date: string | null;
  expiry_date: string;
  days_to_expiry: number;
  is_expired: boolean;
  potential_wastage: number;
}

export interface InventoryDetail {
  hospital_id: string;
  hospital_name: string | null;
  medicine_id: string;
  medicine_name: string;
  category: string;
  unit: string;
  criticality_level: string;
  total_quantity: number;
  reserved_quantity: number;
  usable_inventory: number;
  expected_daily_demand: number;
  days_of_supply: number;
  projected_stockout_date: string | null;
  days_until_stockout: number | null;
  risk_level: string;
  batches: InventoryBatch[];
  incoming_purchase_orders_quantity: number;
  supplier_lead_time_days: number;
  supplier_name: string | null;
}

export interface StockoutRiskItem {
  hospital_id: string;
  medicine_id: string;
  medicine_name: string;
  category: string;
  criticality_level: string;
  current_stock: number;
  usable_stock: number;
  daily_demand: number;
  days_of_supply: number;
  days_until_stockout: number | null;
  projected_stockout_date: string | null;
  risk_level: string;
}

export interface ExpiryRiskItem {
  hospital_id: string;
  medicine_id: string;
  medicine_name: string;
  batch_id: string;
  batch_number: string;
  quantity: number;
  expiry_date: string;
  days_to_expiry: number;
  expected_consumption_before_expiry: number;
  potential_wastage: number;
}

export interface ProcurementRecommendation {
  id: string;
  medicine_id: string;
  medicine_name: string;
  category: string;
  criticality_level: string;
  recommended_quantity: number;
  source_id: string | null;
  source_name: string | null;
  lead_time_days: number;
  unit_price: number;
  estimated_cost: number;
  expected_delivery_date: string;
  urgency: string;
  reason: string;
}

export interface SimpleRedistribution {
  medicine_id: string;
  medicine_name: string;
  source_name: string;
  destination_hospital_name: string;
  suggested_quantity: number;
  reason: string;
}

export interface DashboardKPIs {
  total_medicines: number;
  critical_stockout_risks: number;
  high_stockout_risks: number;
  expiry_risk_batches: number;
  total_potential_wastage_units: number;
  pending_procurement_orders: number;
  total_recommended_orders: number;
}

export interface DashboardResponse {
  hospital: Hospital;
  kpis: DashboardKPIs;
  critical_alerts: StockoutRiskItem[];
  expiry_alerts: ExpiryRiskItem[];
  top_recommendations: ProcurementRecommendation[];
  redistribution_suggestions: SimpleRedistribution[];
}

/* ---------------- Raw endpoint clients ---------------- */

export function getHospitalsList(signal?: AbortSignal): Promise<HospitalOption[]> {
  return getHospitals(signal);
}

export function getInventory(hospitalId: string, signal?: AbortSignal): Promise<InventoryDetail[]> {
  return request<InventoryDetail[]>(
    `/api/v1/inventory?hospital_id=${encodeURIComponent(hospitalId)}`,
    signal,
  );
}

export function getStockoutRisks(
  hospitalId: string,
  signal?: AbortSignal,
): Promise<StockoutRiskItem[]> {
  return request<StockoutRiskItem[]>(
    `/api/v1/risks/stockout?hospital_id=${encodeURIComponent(hospitalId)}`,
    signal,
  );
}

export function getExpiryRisks(
  hospitalId: string,
  signal?: AbortSignal,
): Promise<ExpiryRiskItem[]> {
  return request<ExpiryRiskItem[]>(
    `/api/v1/risks/expiry?hospital_id=${encodeURIComponent(hospitalId)}`,
    signal,
  );
}

export function getProcurement(
  hospitalId: string,
  signal?: AbortSignal,
): Promise<ProcurementRecommendation[]> {
  return request<ProcurementRecommendation[]>(
    `/api/v1/procurement/recommendations?hospital_id=${encodeURIComponent(hospitalId)}`,
    signal,
  );
}

export function getRedistribution(
  hospitalId: string,
  signal?: AbortSignal,
): Promise<SimpleRedistribution[]> {
  return request<SimpleRedistribution[]>(
    `/api/v1/procurement/redistribution?hospital_id=${encodeURIComponent(hospitalId)}`,
    signal,
  );
}

export function getDashboard(
  hospitalId: string,
  signal?: AbortSignal,
): Promise<DashboardResponse> {
  return request<DashboardResponse>(
    `/api/v1/dashboard?hospital_id=${encodeURIComponent(hospitalId)}`,
    signal,
  );
}

/* ---------------- View-model mappers ---------------- */

/** Representative expiry date for a medicine: nearest non-expired lot, else last lot. */
function pickExpiry(item: InventoryDetail): string | null {
  const future = item.batches
    .filter((b) => b.days_to_expiry > 0)
    .map((b) => b.expiry_date)
    .sort();
  if (future.length) return future[0];
  const all = item.batches.map((b) => b.expiry_date).sort();
  return all.length ? all[all.length - 1] : null;
}

/** Map a real inventory detail to the row shape the Inventory/Shortage/Expiry pages render. */
export function toInventoryRow(item: InventoryDetail): InventoryRow {
  const expiry = pickExpiry(item);
  return {
    hospital_id: item.hospital_id,
    hospital: item.hospital_name ?? item.hospital_id,
    medicine_id: item.medicine_id,
    medicine: item.medicine_name,
    current_quantity: item.total_quantity,
    avg_daily_usage: item.expected_daily_demand,
    days_left: item.days_until_stockout,
    supplier: item.supplier_name ?? "Primary Supplier",
    supplier_lead_time_days: item.supplier_lead_time_days,
    expiry_date: expiry ?? new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10),
    criticality: item.criticality_level,
    // The dataset carries no clinical-alternative flag; assume none available.
    alternative_available: false,
  };
}

export function getInventoryRows(hospitalId: string, signal?: AbortSignal): Promise<InventoryRow[]> {
  return getInventory(hospitalId, signal).then((items) => items.map(toInventoryRow));
}

/** Transfer-row shape rendered by the Redistribution page / dashboard. */
export interface TransferRow {
  id: string;
  from_id: string;
  from: string;
  to_id: string;
  to: string;
  medicine: string;
  quantity: number;
  score: number;
  reasons: string[];
}

function resolveSource(
  sourceName: string,
  hospitals: HospitalOption[],
): { id: string; name: string } {
  const match = /^Facility\s+(H\d+)$/.exec(sourceName);
  if (match) {
    const hospital = hospitals.find((h) => h.id === match[1]);
    return { id: match[1], name: hospital?.name ?? sourceName };
  }
  const hospital = hospitals.find((h) => h.name === sourceName);
  return { id: hospital?.id ?? "external", name: sourceName };
}

export async function getTransferRows(
  hospitalId: string,
  signal?: AbortSignal,
): Promise<TransferRow[]> {
  const [suggestions, hospitals] = await Promise.all([
    getRedistribution(hospitalId, signal),
    getHospitals(signal),
  ]);
  const idByName = new Map(hospitals.map((h) => [h.name, h.id]));

  return suggestions.map((s, index) => {
    const source = resolveSource(s.source_name, hospitals);
    const toId = idByName.get(s.destination_hospital_name) ?? hospitalId;
    // Deterministic route score (0–100) derived from rescued volume.
    const score = Math.min(96, 55 + Math.round(s.suggested_quantity / 50));
    return {
      id: `t-${s.medicine_id}-${index}`,
      from_id: source.id,
      from: source.name,
      to_id: toId,
      to: s.destination_hospital_name,
      medicine: s.medicine_name,
      quantity: s.suggested_quantity,
      score,
      reasons: [s.reason],
    };
  });
}

/** Priority-row shape rendered by the Priority page / dashboard. */
export interface PriorityBreakdown {
  patientLoad: number;
  emergency: number;
  stockout: number;
  criticality: number;
  alternatives: number;
}

export interface PriorityRow {
  hospital_id: string;
  hospital: string;
  score: number;
  level: "Critical" | "High" | "Medium";
  reason: string;
  breakdown: PriorityBreakdown;
}

const CRITICALITY_WEIGHT: Record<string, number> = {
  CRITICAL: 30,
  HIGH: 22,
  MEDIUM: 12,
  LOW: 4,
};

function scaleBreakdown(
  raw: PriorityBreakdown,
  rawSum: number,
  score: number,
): PriorityBreakdown {
  if (rawSum <= score || rawSum === 0) return raw;
  const factor = score / rawSum;
  const scaled: PriorityBreakdown = {
    patientLoad: Math.round(raw.patientLoad * factor),
    emergency: Math.round(raw.emergency * factor),
    stockout: Math.round(raw.stockout * factor),
    criticality: Math.round(raw.criticality * factor),
    alternatives: Math.round(raw.alternatives * factor),
  };
  // Repair rounding drift so the dimension contributions sum to the score.
  const sum = Object.values(scaled).reduce((a, b) => a + b, 0);
  scaled.stockout += score - sum;
  return scaled;
}

/** Deterministic network priority derived from each hospital's live stock-out risks. */
export function priorityFor(hospital: HospitalOption, risks: StockoutRiskItem[]): PriorityRow {
  const atRisk = risks.filter((r) => r.risk_level !== "LOW");
  const criticalCount = atRisk.filter((r) => r.risk_level === "CRITICAL").length;
  const sorted = [...atRisk].sort(
    (a, b) => (a.days_until_stockout ?? 999) - (b.days_until_stockout ?? 999),
  );
  const worst = sorted[0];
  const worstDays = worst?.days_until_stockout ?? 999;

  const stockout =
    worstDays >= 999 ? 0 : Math.max(0, Math.round((30 - worstDays * 6) * 10) / 10);
  const criticality = atRisk.reduce(
    (max, r) => Math.max(max, CRITICALITY_WEIGHT[r.criticality_level] ?? 4),
    0,
  );
  const patientLoad = Math.min(30, atRisk.length * 3);
  const emergency = Math.min(30, criticalCount * 6);
  const alternatives = atRisk.length > 0 ? 10 : 0;

  const raw: PriorityBreakdown = { patientLoad, emergency, stockout, criticality, alternatives };
  const rawSum = patientLoad + emergency + stockout + criticality + alternatives;
  // Normalize to 0–100 against the theoretical max (30+30+30+30+10) so
  // hospitals actually rank instead of all saturating at the cap.
  const score = Math.round((rawSum / 130) * 100);
  const level: PriorityRow["level"] = score >= 80 ? "Critical" : score >= 50 ? "High" : "Medium";

  const reason = worst
    ? `${worst.medicine_name} ${
        worst.days_until_stockout != null
          ? `at ${worst.days_until_stockout.toFixed(1)} days of cover`
          : "below safety stock"
      } (${worst.risk_level})`
    : "No active stock-out signals";

  return {
    hospital_id: hospital.id,
    hospital: hospital.name,
    score,
    level,
    reason,
    breakdown: scaleBreakdown(raw, rawSum, score),
  };
}

/** Rank every network hospital by derived urgency (highest first). */
export async function getNetworkPriorities(signal?: AbortSignal): Promise<PriorityRow[]> {
  const hospitals = await getHospitalsList(signal);
  const withRisks = await Promise.all(
    hospitals.map(async (hospital) => {
      try {
        const risks = await getStockoutRisks(hospital.id, signal);
        return priorityFor(hospital, risks);
      } catch {
        return priorityFor(hospital, []);
      }
    }),
  );
  return withRisks.sort((a, b) => b.score - a.score);
}

export { riskOf };
