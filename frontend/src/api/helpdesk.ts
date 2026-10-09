/** Typed Helpdesk API layer — grounded Gemini assistant backed by MedPredict data.
 *
 * Endpoints (backend/app/api/helpdesk.py):
 *   POST /api/v1/helpdesk/query        — hospital-scoped via X-Hospital-Id header
 *   GET  /api/v1/helpdesk/capabilities — starter capabilities for the same scope
 *
 * The backend resolves authority from a valid Bearer token when present and
 * falls back to the X-Hospital-Id header, so components pass the logged-in
 * hospital's id here and never include secrets.
 */

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000";

export interface HelpdeskRequest {
  question: string;
}

export interface EvidenceRow {
  hospital?: string;
  medicine?: string;
  risk?: string;
  projected_stockout_date?: string | null;
  days_of_supply?: number | null;
  quantity?: number;
  total_quantity?: number;
  expected_daily_demand?: number;
  daily_demand?: number;
  supplier?: string;
  supplier_lead_time_days?: number;
  suggested_quantity?: number;
  expiry_date?: string;
  days_to_expiry?: number;
  potential_wastage?: number;
  urgency?: string;
  date?: string;
  predicted_demand?: number;
  is_forecast?: boolean;
  reason?: string;
  detail?: string;
}

export type HelpdeskIntent =
  | "highest_stockout_risk"
  | "expiry_risk"
  | "inventory_lookup"
  | "demand_forecast"
  | "procurement_recommendations"
  | "risk_explanation"
  | "helpdesk_capabilities"
  | "limitation";

export interface HelpdeskResponse {
  answer: string;
  intent: HelpdeskIntent;
  evidence: EvidenceRow[];
  data_as_of: string;
  limitations: string[];
  suggested_questions: string[];
}

export interface HelpdeskCapability {
  intent: HelpdeskIntent;
  description: string;
  example_questions: string[];
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    throw new Error(`Helpdesk request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export function askHelpdesk(
  hospitalId: string,
  question: string,
  signal?: AbortSignal,
): Promise<HelpdeskResponse> {
  return request<HelpdeskResponse>("/api/v1/helpdesk/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hospital-Id": hospitalId,
    },
    body: JSON.stringify({ question } satisfies HelpdeskRequest),
    signal,
  });
}

export function getHelpdeskCapabilities(
  hospitalId: string,
  signal?: AbortSignal,
): Promise<HelpdeskCapability[]> {
  return request<HelpdeskCapability[]>("/api/v1/helpdesk/capabilities", {
    headers: { "X-Hospital-Id": hospitalId },
    signal,
  });
}