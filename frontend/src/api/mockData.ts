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

/** A donor's offer to help with a request. Transport readiness is first-class:
 * a farther donor with a van ready beats a nearer donor with no transport. */
export interface DemoOffer {
  id: string;
  requestId: string;
  donor: string;
  quantity: number;
  canTransportImmediately: boolean;
  etaHours: number | null; // set when transport is NOT immediate
  date: string;
  note: string;
}

export const DEMO_OFFERS: DemoOffer[] = [
  {
    id: "off-201", requestId: "req-101", donor: "Hospital A",
    quantity: 300, canTransportImmediately: false, etaHours: 6,
    date: "2026-10-07", note: "0.7 km away, but no cold-chain vehicle free until evening",
  },
  {
    id: "off-202", requestId: "req-101", donor: "Hospital C",
    quantity: 200, canTransportImmediately: true, etaHours: 1,
    date: "2026-10-07", note: "2 km away, van ready now",
  },
  {
    id: "off-203", requestId: "req-103", donor: "Hospital D",
    quantity: 800, canTransportImmediately: true, etaHours: 2,
    date: "2026-10-07", note: "Surplus from cancelled camp, driver on standby",
  },
  {
    id: "off-204", requestId: "req-103", donor: "Hospital B",
    quantity: 500, canTransportImmediately: false, etaHours: 8,
    date: "2026-10-08", note: "Needs pickup — no vehicle available today",
  },
  {
    id: "off-205", requestId: "req-102", donor: "Hospital A",
    quantity: 1500, canTransportImmediately: true, etaHours: 3,
    date: "2026-10-06", note: "Expiring batch, can dispatch today",
  },
];
