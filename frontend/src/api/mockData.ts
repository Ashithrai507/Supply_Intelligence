/** Local demo network requirement board.
 *
 * The rest of the app reads the real dataset through `api/medpredict.ts`.
 * Requirements are not yet persisted by the backend, so this small list stays
 * local and is clearly labelled with the `DemoBadge` on the Requests page.
 *
 * This is a global, non-urgent board: facilities post medicines they need but
 * do not need immediately. Critical shortages are handled by procurement and
 * redistribution instead.
 */

export type RequestUrgency = "Low" | "Normal" | "High";
export type RequestStatus = "Pending" | "Approved" | "Fulfilled";

export interface DemoRequest {
  id: string;
  hospital: string;
  medicine: string;
  quantity: number;
  urgency: RequestUrgency;
  status: RequestStatus;
  date: string;
  note: string;
}

export const DEMO_REQUESTS: DemoRequest[] = [
  {
    id: "req-101", hospital: "Hospital B", medicine: "Insulin Glargine",
    quantity: 500, urgency: "High", status: "Pending",
    date: "2026-10-07", note: "Cold-chain buffer restock before Q4",
  },
  {
    id: "req-102", hospital: "Hospital C", medicine: "Paracetamol",
    quantity: 3000, urgency: "High", status: "Approved",
    date: "2026-10-06", note: "Planning ahead for seasonal demand",
  },
  {
    id: "req-103", hospital: "Hospital A", medicine: "Amoxicillin",
    quantity: 1200, urgency: "Normal", status: "Pending",
    date: "2026-10-07", note: "Post-surgical ward restock",
  },
  {
    id: "req-104", hospital: "Hospital D", medicine: "Amoxicillin",
    quantity: 600, urgency: "Low", status: "Pending",
    date: "2026-10-05", note: "Routine restock for flu season",
  },
  {
    id: "req-105", hospital: "Hospital A", medicine: "Oral Rehydration Salts",
    quantity: 2000, urgency: "Low", status: "Fulfilled",
    date: "2026-10-02", note: "Monsoon preparedness stock",
  },
  {
    id: "req-106", hospital: "Hospital C", medicine: "Insulin Glargine",
    quantity: 400, urgency: "Normal", status: "Approved",
    date: "2026-10-04", note: "ICU buffer top-up",
  },
];
