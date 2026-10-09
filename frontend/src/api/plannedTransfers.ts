/** User-confirmed transfers planned from the Expiry page (or elsewhere).
 * Persisted in localStorage so the Redistribution page picks them up on mount.
 * Shape matches TransferRow (see api/medpredict) for seamless merging. */

export interface PlannedTransfer {
  id: string;
  from_id: string;
  from: string;
  to_id: string;
  to: string;
  medicine: string;
  quantity: number;
  score: number;
  reasons: string[];
  date: string;
}

const STORAGE_KEY = "medipulse_planned_transfers";

export function loadPlannedTransfers(): PlannedTransfer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PlannedTransfer[]) : [];
  } catch {
    return [];
  }
}

export function addPlannedTransfer(t: PlannedTransfer): PlannedTransfer[] {
  const next = [t, ...loadPlannedTransfers()];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — caller still gets the updated list
  }
  return next;
}

export function clearPlannedTransfers(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
