import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  DEMO_OFFERS,
  DEMO_REQUESTS,
  type DemoOffer,
  type DemoRequest,
  type RequestStatus,
  type RequestUrgency,
} from "../api/mockData";
import { getMedicines } from "../api/forecast";
import { useAuth } from "../context/AuthContext";
import DemoBadge from "../components/DemoBadge";

const URGENCIES: RequestUrgency[] = ["Low", "Normal", "High"];
const STATUSES: Array<"All" | RequestStatus> = ["All", "Pending", "Approved", "Fulfilled"];

const URGENCY_STYLES: Record<RequestUrgency, string> = {
  Low: "bg-gray-100 text-gray-700 border-gray-300",
  Normal: "bg-green-100 text-green-800 border-green-300",
  High: "bg-orange-100 text-orange-800 border-orange-300",
};

const STATUS_STYLES: Record<RequestStatus, string> = {
  Pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  Approved: "bg-blue-100 text-blue-800 border-blue-300",
  Fulfilled: "bg-green-100 text-green-800 border-green-300",
};

const FALLBACK_MEDICINES = Array.from(new Set(DEMO_REQUESTS.map((r) => r.medicine))).sort();

const inputCls = "w-full rounded border border-gray-300 px-2 py-1 text-sm";

/** Best offer first: immediate transport beats waiting, then larger quantity. */
function sortOffers(offers: DemoOffer[]): DemoOffer[] {
  return [...offers].sort((a, b) => {
    if (a.canTransportImmediately !== b.canTransportImmediately) {
      return a.canTransportImmediately ? -1 : 1;
    }
    return b.quantity - a.quantity;
  });
}

function transportLabel(o: DemoOffer): string {
  if (o.canTransportImmediately) return `Immediate transport (~${o.etaHours ?? 1}h)`;
  return o.etaHours != null ? `Pickup needed (~${o.etaHours}h)` : "Pickup needed";
}

/** Requests page: network board + click-through detail with grant/help offers. */
export default function Requests() {
  const { user } = useAuth();
  const requester = user?.name ?? "Hospital A";
  const [requests, setRequests] = useState<DemoRequest[]>(DEMO_REQUESTS);
  const [offers, setOffers] = useState<DemoOffer[]>(DEMO_OFFERS);
  const [urgencyFilter, setUrgencyFilter] = useState<"All" | RequestUrgency>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | RequestStatus>("All");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Medicine options come from the live dataset; fall back to the demo list if offline.
  const [medicines, setMedicines] = useState<string[]>(FALLBACK_MEDICINES);

  const [medicine, setMedicine] = useState(FALLBACK_MEDICINES[0]);
  const [quantity, setQuantity] = useState("");
  const [urgency, setUrgency] = useState<RequestUrgency>("Normal");
  const [formError, setFormError] = useState<string | null>(null);

  // Offer form state (inside the detail modal).
  const [offerQty, setOfferQty] = useState("");
  const [offerTransport, setOfferTransport] = useState(false);
  const [offerEta, setOfferEta] = useState("");
  const [offerError, setOfferError] = useState<string | null>(null);

  useEffect(() => {
    getMedicines()
      .then((medicineOptions) => {
        if (medicineOptions.length) {
          const names = medicineOptions.map((m) => m.name);
          setMedicines(names);
          setMedicine((current) => (names.includes(current) ? current : names[0]));
        }
      })
      .catch(() => {
        // Offline — keep the demo-derived selector options.
      });
  }, []);

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
  const selected = requests.find((r) => r.id === selectedId) ?? null;
  const selectedOffers = useMemo(
    () => (selected ? sortOffers(offers.filter((o) => o.requestId === selected.id)) : []),
    [offers, selected],
  );
  const offeredQty = selectedOffers.reduce((s, o) => s + o.quantity, 0);

  function openDetail(id: string) {
    setSelectedId(id);
    setOfferQty("");
    setOfferTransport(false);
    setOfferEta("");
    setOfferError(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const qty = Number(quantity);
    if (!medicine) {
      setFormError("Choose a medicine.");
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
        hospital: requester,
        medicine,
        quantity: Math.floor(qty),
        urgency,
        status: "Pending",
        date: today,
        note: "Posted to the network board",
      },
      ...prev,
    ]);
    setQuantity("");
    setUrgency("Normal");
    setFormError(null);
    setFormOpen(false);
  }

  function submitOffer(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const qty = Number(offerQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setOfferError("Quantity must be a positive number.");
      return;
    }
    const eta = offerTransport ? 1 : Number(offerEta);
    if (!offerTransport && (!Number.isFinite(eta) || eta <= 0)) {
      setOfferError("Enter when transport can reach (hours), or tick immediate transport.");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    setOffers((prev) => [
      {
        id: `off-${Date.now()}`,
        requestId: selected.id,
        donor: requester,
        quantity: Math.floor(qty),
        canTransportImmediately: offerTransport,
        etaHours: Math.floor(eta),
        date: today,
        note: offerTransport ? "Vehicle ready now" : "Needs pickup arrangement",
      },
      ...prev,
    ]);
    setOfferQty("");
    setOfferTransport(false);
    setOfferEta("");
    setOfferError(null);
  }

  return (
    <div className="pb-20">
      <div className="mb-1 flex items-baseline justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl font-semibold">Network Requirements</h2>
          <DemoBadge />
        </div>
        <p className="text-sm text-gray-600">
          {pendingCount} pending · {filtered.length} shown
        </p>
      </div>
      <p className="mb-4 text-sm text-gray-600">
        Non-urgent needs posted across the network. Click a request to see offers and grant help.
      </p>

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
          No requirements match these filters.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((r) => {
            const count = offers.filter((o) => o.requestId === r.id).length;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => openDetail(r.id)}
                className="rounded border border-gray-200 bg-white p-4 text-left hover:border-gray-400 hover:shadow"
              >
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
                <p className="mt-1 text-xs text-gray-400">
                  Requested {r.date} · {count} offer{count === 1 ? "" : "s"} · Click to view and help
                </p>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4" onClick={() => setSelectedId(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-gray-200 bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold">{selected.hospital} needs {selected.medicine}</h3>
                <p className="text-sm text-gray-600">
                  {selected.quantity.toLocaleString()} units · {selected.urgency} urgency · {selected.status}
                </p>
                <p className="mt-1 text-sm text-gray-600">{selected.note}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded border border-gray-300 px-2 py-0.5 text-sm hover:bg-gray-100"
              >
                Close
              </button>
            </div>

            <div className="mt-2 rounded bg-gray-50 px-2 py-1 text-sm">
              Offered so far: <strong>{offeredQty.toLocaleString()}</strong> / {selected.quantity.toLocaleString()} units
              {offeredQty >= selected.quantity && (
                <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                  Fully covered
                </span>
              )}
            </div>

            <h4 className="mb-2 mt-4 font-semibold">Offers ({selectedOffers.length})</h4>
            {selectedOffers.length === 0 ? (
              <p className="rounded border border-gray-200 bg-white p-4 text-center text-sm text-gray-600">
                No offers yet — be the first to help.
              </p>
            ) : (
              <ul className="space-y-2">
                {selectedOffers.map((o, i) => (
                  <li key={o.id} className="rounded border border-gray-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{o.donor}</p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                          o.canTransportImmediately
                            ? "bg-green-100 text-green-800 border-green-300"
                            : "bg-amber-100 text-amber-800 border-amber-300"
                        }`}
                      >
                        {transportLabel(o)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{o.quantity.toLocaleString()} units · {o.note}</p>
                    <p className="text-xs text-gray-400">Offered {o.date}</p>
                    {i === 0 && o.canTransportImmediately && (
                      <p className="mt-1 text-xs font-semibold text-green-700">Suggested: fastest to the requester</p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <h4 className="mb-2 mt-4 font-semibold">Grant help</h4>
            {selected.hospital === requester ? (
              <p className="rounded bg-gray-50 px-2 py-1 text-sm text-gray-600">
                This is your facility's request — other hospitals will offer help here.
              </p>
            ) : (
              <form onSubmit={submitOffer} className="space-y-2">
                <div className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-sm">
                  <span className="text-gray-500">Donating facility: </span>
                  <span className="font-semibold text-gray-800">{requester}</span>
                </div>
                <label className="block text-sm">
                  Quantity you can provide (units)
                  <input
                    className={inputCls}
                    type="number"
                    min={1}
                    placeholder="e.g. 500"
                    value={offerQty}
                    onChange={(e) => setOfferQty(e.target.value)}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={offerTransport}
                    onChange={(e) => setOfferTransport(e.target.checked)}
                  />
                  We can transport it immediately
                </label>
                {!offerTransport && (
                  <label className="block text-sm">
                    Transport reachable in (hours)
                    <input
                      className={inputCls}
                      type="number"
                      min={1}
                      placeholder="e.g. 6"
                      value={offerEta}
                      onChange={(e) => setOfferEta(e.target.value)}
                    />
                  </label>
                )}
                {offerError && <p className="text-sm text-red-700">{offerError}</p>}
                <div className="flex justify-end">
                  <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-sm font-semibold text-white hover:bg-gray-700">
                    Offer help
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {!formOpen ? (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="fixed bottom-6 right-6 rounded-full bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-gray-700"
        >
          + Post Requirement
        </button>
      ) : (
        <div className="fixed inset-0 z-10 flex items-end justify-end bg-black/30 p-4" onClick={() => setFormOpen(false)}>
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-4 shadow-xl"
          >
            <h3 className="mb-3 font-semibold">Post a requirement</h3>
            <div className="space-y-2">
              <div className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-sm">
                <span className="text-gray-500">Requesting facility: </span>
                <span className="font-semibold text-gray-800">{requester}</span>
              </div>
              <label className="block text-sm">
                Medicine needed
                <select className={inputCls} value={medicine} onChange={(e) => setMedicine(e.target.value)}>
                  {medicines.map((m) => (
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
                  Post requirement
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
