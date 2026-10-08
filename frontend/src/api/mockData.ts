/** Filler demo data for presentations (Issue #32/#33 UI viewable without the backend).
 * Shapes match the T4/T6 contracts exactly. Used ONLY as a fetch-failure
 * fallback by api/client.ts — live API responses always win when reachable.
 */

import type { ForecastRow, ForecastSeries, InventoryRow } from "./client";

export const DEMO_INVENTORY: InventoryRow[] = [
  {
    hospital_id: "h1", hospital: "City General Hospital",
    medicine_id: "m1", medicine: "Paracetamol",
    current_quantity: 4200, avg_daily_usage: 610.5, days_left: 6.9,
    supplier: "MediSupply Co.", supplier_lead_time_days: 8,
    expiry_date: "2027-06-15", criticality: "low", alternative_available: true,
  },
  {
    hospital_id: "h1", hospital: "City General Hospital",
    medicine_id: "m2", medicine: "Amoxicillin",
    current_quantity: 900, avg_daily_usage: 420.0, days_left: 2.1,
    supplier: "MediSupply Co.", supplier_lead_time_days: 5,
    expiry_date: "2027-03-02", criticality: "critical", alternative_available: false,
  },
  {
    hospital_id: "h1", hospital: "City General Hospital",
    medicine_id: "m3", medicine: "Insulin Glargine",
    current_quantity: 350, avg_daily_usage: 95.5, days_left: 3.7,
    supplier: "ColdChain Labs", supplier_lead_time_days: 6,
    expiry_date: "2026-10-20", criticality: "critical", alternative_available: false,
  },
  {
    hospital_id: "h1", hospital: "City General Hospital",
    medicine_id: "m4", medicine: "Oral Rehydration Salts",
    current_quantity: 12000, avg_daily_usage: 300.0, days_left: 40.0,
    supplier: "MediSupply Co.", supplier_lead_time_days: 4,
    expiry_date: "2027-12-01", criticality: "medium", alternative_available: true,
  },
  {
    hospital_id: "h2", hospital: "Riverside District Hospital",
    medicine_id: "m1", medicine: "Paracetamol",
    current_quantity: 15000, avg_daily_usage: 480.0, days_left: 31.3,
    supplier: "MediSupply Co.", supplier_lead_time_days: 8,
    expiry_date: "2026-10-22", criticality: "low", alternative_available: true,
  },
  {
    hospital_id: "h2", hospital: "Riverside District Hospital",
    medicine_id: "m2", medicine: "Amoxicillin",
    current_quantity: 8000, avg_daily_usage: 390.0, days_left: 20.5,
    supplier: "MediSupply Co.", supplier_lead_time_days: 5,
    expiry_date: "2027-05-11", criticality: "critical", alternative_available: false,
  },
  {
    hospital_id: "h2", hospital: "Riverside District Hospital",
    medicine_id: "m3", medicine: "Insulin Glargine",
    current_quantity: 0, avg_daily_usage: 60.0, days_left: 0,
    supplier: "ColdChain Labs", supplier_lead_time_days: 6,
    expiry_date: "2027-02-14", criticality: "critical", alternative_available: false,
  },
  {
    hospital_id: "h2", hospital: "Riverside District Hospital",
    medicine_id: "m4", medicine: "Oral Rehydration Salts",
    current_quantity: 5200, avg_daily_usage: 410.0, days_left: 12.7,
    supplier: "MediSupply Co.", supplier_lead_time_days: 4,
    expiry_date: "2027-09-30", criticality: "medium", alternative_available: true,
  },
  {
    hospital_id: "h3", hospital: "St. Mary's Tertiary Care",
    medicine_id: "m1", medicine: "Paracetamol",
    current_quantity: 2600, avg_daily_usage: 890.0, days_left: 2.9,
    supplier: "NovaPharm", supplier_lead_time_days: 7,
    expiry_date: "2027-04-18", criticality: "low", alternative_available: true,
  },
  {
    hospital_id: "h3", hospital: "St. Mary's Tertiary Care",
    medicine_id: "m2", medicine: "Amoxicillin",
    current_quantity: 3100, avg_daily_usage: 455.0, days_left: 6.8,
    supplier: "NovaPharm", supplier_lead_time_days: 7,
    expiry_date: "2026-10-25", criticality: "critical", alternative_available: true,
  },
  {
    hospital_id: "h3", hospital: "St. Mary's Tertiary Care",
    medicine_id: "m3", medicine: "Insulin Glargine",
    current_quantity: 1200, avg_daily_usage: 110.0, days_left: 10.9,
    supplier: "ColdChain Labs", supplier_lead_time_days: 6,
    expiry_date: "2027-01-30", criticality: "critical", alternative_available: false,
  },
  {
    hospital_id: "h3", hospital: "St. Mary's Tertiary Care",
    medicine_id: "m4", medicine: "Oral Rehydration Salts",
    current_quantity: 9800, avg_daily_usage: 520.0, days_left: 18.8,
    supplier: "NovaPharm", supplier_lead_time_days: 7,
    expiry_date: "2027-08-12", criticality: "medium", alternative_available: true,
  },
  {
    hospital_id: "h4", hospital: "Lakeside Community Clinic",
    medicine_id: "m1", medicine: "Paracetamol",
    current_quantity: 750, avg_daily_usage: 120.0, days_left: 6.3,
    supplier: "MediSupply Co.", supplier_lead_time_days: 8,
    expiry_date: "2027-07-07", criticality: "low", alternative_available: true,
  },
  {
    hospital_id: "h4", hospital: "Lakeside Community Clinic",
    medicine_id: "m2", medicine: "Amoxicillin",
    current_quantity: 400, avg_daily_usage: 85.0, days_left: 4.7,
    supplier: "MediSupply Co.", supplier_lead_time_days: 5,
    expiry_date: "2027-06-01", criticality: "critical", alternative_available: false,
  },
  {
    hospital_id: "h4", hospital: "Lakeside Community Clinic",
    medicine_id: "m3", medicine: "Insulin Glargine",
    current_quantity: 180, avg_daily_usage: 22.0, days_left: 8.2,
    supplier: "ColdChain Labs", supplier_lead_time_days: 6,
    expiry_date: "2027-03-19", criticality: "critical", alternative_available: false,
  },
  {
    hospital_id: "h4", hospital: "Lakeside Community Clinic",
    medicine_id: "m4", medicine: "Oral Rehydration Salts",
    current_quantity: 2300, avg_daily_usage: 95.0, days_left: 24.2,
    supplier: "MediSupply Co.", supplier_lead_time_days: 4,
    expiry_date: "2027-11-25", criticality: "medium", alternative_available: true,
  },
];

export const DEMO_FORECASTS: ForecastRow[] = [
  {
    hospital_id: "h1", hospital_name: "City General Hospital",
    medicine_id: "m1", medicine_name: "Paracetamol",
    baseline_daily_demand: 585.0, predicted_daily_demand: 690.0,
    predicted_weekly_demand: 4830.0, trend_growth_pct: 17.9,
    outbreak_multiplier: 1.0, confidence: "high",
  },
  {
    hospital_id: "h3", hospital_name: "St. Mary's Tertiary Care",
    medicine_id: "m1", medicine_name: "Paracetamol",
    baseline_daily_demand: 640.0, predicted_daily_demand: 1152.0,
    predicted_weekly_demand: 8064.0, trend_growth_pct: 38.0,
    outbreak_multiplier: 1.3, confidence: "low",
  },
  {
    hospital_id: "h1", hospital_name: "City General Hospital",
    medicine_id: "m2", medicine_name: "Amoxicillin",
    baseline_daily_demand: 400.0, predicted_daily_demand: 420.0,
    predicted_weekly_demand: 2940.0, trend_growth_pct: 5.0,
    outbreak_multiplier: 1.0, confidence: "medium",
  },
  {
    hospital_id: "h2", hospital_name: "Riverside District Hospital",
    medicine_id: "m3", medicine_name: "Insulin Glargine",
    baseline_daily_demand: 58.0, predicted_daily_demand: 61.0,
    predicted_weekly_demand: 427.0, trend_growth_pct: 5.2,
    outbreak_multiplier: 1.0, confidence: "high",
  },
];

/** Filler transfers + priority ranking (presentation only, same shapes as T9/T10). */
export interface DemoTransfer {
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

export const DEMO_TRANSFERS: DemoTransfer[] = [
  {
    id: "t1",
    from_id: "h2", from: "Riverside District Hospital",
    to_id: "h1", to: "City General Hospital",
    medicine: "Paracetamol", quantity: 2000, score: 92,
    reasons: [
      "City General runs out in 6.9 days",
      "Riverside holds ~8,200 surplus units above expected use",
      "Donor batch expires in 14 days",
      "44 km, 1.5 h transit — arrives before the stock-out date",
    ],
  },
  {
    id: "t2",
    from_id: "h2", from: "Riverside District Hospital",
    to_id: "h3", to: "St. Mary's Tertiary Care",
    medicine: "Amoxicillin", quantity: 1500, score: 84,
    reasons: [
      "St. Mary's runs out in 6.8 days with rising demand",
      "Riverside holds 20.5 days of cover and stays above safety stock",
      "Recipient has no stocked alternative",
    ],
  },
  {
    id: "t3",
    from_id: "h1", from: "City General Hospital",
    to_id: "h2", to: "Riverside District Hospital",
    medicine: "Oral Rehydration Salts", quantity: 800, score: 64,
    reasons: [
      "Riverside at 12.7 days with +22% emergency demand",
      "City General holds 40 days of cover",
      "Low criticality — routine top-up",
    ],
  },
];

export interface DemoPriority {
  hospital_id: string;
  hospital: string;
  score: number;
  level: "Critical" | "High" | "Medium";
  reason: string;
  breakdown: { patientLoad: number; emergency: number; stockout: number; criticality: number; alternatives: number };
}

export const DEMO_PRIORITIES: DemoPriority[] = [
  {
    hospital_id: "h2", hospital: "Riverside District Hospital", score: 95, level: "Critical",
    reason: "Insulin at zero stock, no alternative available",
    breakdown: { patientLoad: 24, emergency: 28, stockout: 19, criticality: 15, alternatives: 9 },
  },
  {
    hospital_id: "h3", hospital: "St. Mary's Tertiary Care", score: 92, level: "Critical",
    reason: "Paracetamol demand up 38% on outbreak signal, 2.9 days left",
    breakdown: { patientLoad: 27, emergency: 25, stockout: 18, criticality: 14, alternatives: 8 },
  },
  {
    hospital_id: "h1", hospital: "City General Hospital", score: 87, level: "Critical",
    reason: "Amoxicillin at 2.1 days, lead time 5 days cannot cover",
    breakdown: { patientLoad: 22, emergency: 24, stockout: 17, criticality: 15, alternatives: 9 },
  },
  {
    hospital_id: "h4", hospital: "Lakeside Community Clinic", score: 68, level: "Medium",
    reason: "Amoxicillin at 4.7 days but low patient load",
    breakdown: { patientLoad: 14, emergency: 16, stockout: 14, criticality: 15, alternatives: 9 },
  },
];
/** Deterministic 30-day history + 14-day forecast for any hospital×medicine pair. */
export function demoSeries(hospitalId: string, medicineId: string): ForecastSeries {
  const row = DEMO_FORECASTS.find((r) => r.hospital_id === hospitalId && r.medicine_id === medicineId)
    ?? DEMO_FORECASTS[0];
  let seed = 0;
  for (const ch of `${hospitalId}:${medicineId}`) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return (seed % 1000) / 1000 - 0.5; // [-0.5, 0.5)
  };
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const history = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    const ramp = 1 + (row.trend_growth_pct / 100) * (i / 29) * 0.8;
    return {
      date: iso(d),
      quantity_used: Math.max(0, Math.round(row.baseline_daily_demand * ramp + rand() * row.baseline_daily_demand * 0.12)),
    };
  });
  const forecast = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i + 1);
    return { date: iso(d), predicted_daily: Math.round(row.predicted_daily_demand * 10) / 10 };
  });
  return { history, forecast };
}
