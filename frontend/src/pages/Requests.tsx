import { useMemo, useState, type FormEvent } from "react";
import {
  DEMO_REQUESTS,
  type DemoRequest,
  type RequestStatus,
  type RequestUrgency,
} from "../api/mockData";

const URGENCIES: RequestUrgency[] = ["Critical", "High", "Normal"];
const STATUSES: Array<"All" | RequestStatus> = ["All", "Pending", "Approved", "Fulfilled"];

const URGENCY_STYLES: Record<RequestUrgency, string> = {
  Critical: "bg-red-100 text-red-800 border-red-300",
  High: "bg-orange-100 text-orange-800 border-orange-300",
  Normal: "bg-green-100 text-green-800 border-green-300",
};

const STATUS_STYLES: Record<RequestStatus, string> = {
  Pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  Approved: "bg-blue-100 text-blue-800 border-blue-300",
  Fulfilled: "bg-green-100 text-green-800 border-green-300",
};

const HOSPITALS = Array.from(new Set(DEMO_REQUESTS.map((r) => r.hospital))).sort();
const MEDICINES = Array.from(new Set(DEMO_REQUESTS.map((r) => r.medicine))).sort();

const inputCls = "w-full rounded border border-gray-300 px-2 py-1 text-sm";

/** Requests page: visible list of facility requests + bottom-right New Request form. */
export default function Requests() {
  const [requests, setRequests] = useState<DemoRequest[]>(DEMO_REQUESTS);
  const [urgencyFilter, setUrgencyFilter] = useState<"All" | RequestUrgency>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | RequestStatus>("All");
  const [formOpen, setFormOpen] = useState(false);

  const [hospital, setHospital] = useState(HOSPITALS[0]);
  const [medicine, setMedicine] = useState(MEDICINES[0]);
  const [quantity, setQuantity] = useState("");
  const [urgency, setUrgency] = useState<RequestUrgency>("Normal");
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      requests.filter(
        (r) =>
          (urgencyFilter === "All" || r.urgency === urgencyFilter) &&
          (statusFilter === "All" || r.status === statusFilter),
      ),
    [requests, urgencyFilter, statusFilter],
  );

  const pendingCount = requests.filter((r) => r.status === "Pending").length;

  function submit(e: FormEvent) {
    e.preventDefault();
    const qty = Number(quantity);
    if (!hospital || !medicine) {
      setFormError("Choose an organization and a medicine.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError("Quantity must be a positive number.");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    setRequests((prev) => [
      {
        id: `req-${Date.now()}`,
        hospital,
        medicine,
        quantity: Math.floor(qty),
        urgency,
        status: "Pending",
        date: today,
        note: "Submitted from the dashboard",
      },
      ...prev,
    ]);
    setQuantity("");
    setUrgency("Normal");
    setFormError(null);
    setFormOpen(false);
  }

  return (
    <div className="pb-20">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Supply Requests</h2>
        <p className="text-sm text-gray-600">
          {pendingCount} pending · {filtered.length} shown
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 rounded border border-gray-200 bg-gray-50 p-3">
        <label className="flex items-center gap-1 text-sm">
          Urgency{" "}
          <select
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value as "All" | RequestUrgency)}
          >
            {["All", ...URGENCIES].map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm">
          Status{" "}
          <select
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "All" | RequestStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded border border-gray-200 bg-white p-6 text-center text-gray-600">
          No requests match these filters.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((r) => (
            <div key={r.id} className="rounded border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{r.hospital}</h3>
                <div className="flex gap-1">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${URGENCY_STYLES[r.urgency]}`}>
                    {r.urgency} urgency
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[r.status]}`}>
                    {r.status}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-sm">
                <span className="font-semibold">{r.quantity.toLocaleString()} units</span> of {r.medicine}
              </p>
              <p className="mt-1 text-sm text-gray-600">{r.note}</p>
              <p className="mt-1 text-xs text-gray-400">Requested {r.date} · {r.id}</p>
            </div>
          ))}
        </div>
      )}

      {!formOpen ? (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="fixed bottom-6 right-6 rounded-full bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-gray-700"
        >
          + New Request
        </button>
      ) : (
        <div className="fixed inset-0 z-10 flex items-end justify-end bg-black/30 p-4" onClick={() => setFormOpen(false)}>
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-4 shadow-xl"
          >
            <h3 className="mb-3 font-semibold">New supply request</h3>
            <div className="space-y-2">
              <label className="block text-sm">
                Organization
                <select className={inputCls} value={hospital} onChange={(e) => setHospital(e.target.value)}>
                  {HOSPITALS.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Medicine needed
                <select className={inputCls} value={medicine} onChange={(e) => setMedicine(e.target.value)}>
                  {MEDICINES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Quantity (units)
                <input
                  className={inputCls}
                  type="number"
                  min={1}
                  placeholder="e.g. 1000"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Urgency
                <select className={inputCls} value={urgency} onChange={(e) => setUrgency(e.target.value as RequestUrgency)}>
                  {URGENCIES.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </label>
              {formError && <p className="text-sm text-red-700">{formError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-sm font-semibold text-white hover:bg-gray-700">
                  Submit request
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
