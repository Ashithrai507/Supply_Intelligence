import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CheckSquare,
  Download,
  Search,
  Truck,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getTransferRows, type TransferRow } from "../api/medpredict";
import { useAuth } from "../context/AuthContext";

export default function Redistribution() {
  const { user } = useAuth();
  const currentHospitalName = user?.name ?? "Hospital A";

  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [scopeMode, setScopeMode] = useState<"my-org" | "incoming" | "outgoing" | "all">("my-org");
  const [searchTerm, setSearchTerm] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    getTransferRows(user.id)
      .then(setTransfers)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleApprove = (id: string) => {
    setApprovedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        showToast("Transfer status reverted to pending.");
      } else {
        next.add(id);
        showToast("Transfer approved! Logistics dispatch notification queued.");
      }
      return next;
    });
  };

  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      const isIncoming = t.to === currentHospitalName;
      const isOutgoing = t.from === currentHospitalName;

      if (scopeMode === "my-org" && !isIncoming && !isOutgoing) return false;
      if (scopeMode === "incoming" && !isIncoming) return false;
      if (scopeMode === "outgoing" && !isOutgoing) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesMed = t.medicine.toLowerCase().includes(q);
        const matchesFrom = t.from.toLowerCase().includes(q);
        const matchesTo = t.to.toLowerCase().includes(q);
        if (!matchesMed && !matchesFrom && !matchesTo) return false;
      }
      return true;
    });
  }, [transfers, scopeMode, currentHospitalName, searchTerm]);

  const totalTransferUnits = filteredTransfers.reduce((s, t) => s + t.quantity, 0);

  const downloadManifest = () => {
    const lines = [
      "Transfer ID,Donor Hospital,Recipient Hospital,Medicine,Quantity,Urgency Score,Status",
    ];
    for (const t of filteredTransfers) {
      lines.push(
        `"${t.id}","${t.from}","${t.to}","${t.medicine}",${t.quantity},${t.score},"${approvedIds.has(t.id) ? "Approved" : "Proposed"}"`,
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `medipulse_transfers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Downloaded transfer manifest CSV.");
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm font-semibold text-slate-500 dark:text-slate-400">
        Loading redistribution pipeline…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6 text-rose-900 shadow-sm dark:border-rose-800">
        <h3 className="font-bold">Could not load live redistribution data</h3>
        <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-4 py-3 text-xs font-semibold text-white dark:text-slate-900 shadow-xl animate-bounce">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {currentHospitalName} — Peer Redistribution Pipeline
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 dark:text-slate-400">
            Peer-to-peer inventory transfers and emergency deliveries involving {currentHospitalName}.
          </p>
        </div>

        <button
          onClick={downloadManifest}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 transition-all dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Download className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
          <span>Transfer Manifest</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 shadow-xs dark:border-sky-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-800 dark:text-sky-200">Proposed Transfer Routes</span>
            <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold text-white">
              Optimized
            </span>
          </div>
          <p className="mt-2 text-3xl font-extrabold text-sky-900">{filteredTransfers.length}</p>
          <p className="text-xs text-sky-700 mt-1 dark:text-sky-300">
            Algorithmically scored by proximity and stock impact.
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-xs dark:border-emerald-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200">Units to be Rescued</span>
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
              Live Flow
            </span>
          </div>
          <p className="mt-2 text-3xl font-extrabold text-emerald-900">{totalTransferUnits.toLocaleString()}</p>
          <p className="text-xs text-emerald-700 mt-1 dark:text-emerald-300">
            Critical supply units relocated across the network.
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 shadow-xs dark:border-indigo-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-800 dark:text-indigo-200">Dispatch Approval</span>
            <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
              Logistics
            </span>
          </div>
          <p className="mt-2 text-3xl font-extrabold text-indigo-900">
            {approvedIds.size} of {transfers.length} Approved
          </p>
          <p className="text-xs text-indigo-700 mt-1 dark:text-indigo-300">
            Click &quot;Approve Transfer&quot; to simulate dispatch schedule.
          </p>
        </div>
      </div>

      {/* Transfer Quantities Bar Chart */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm space-y-3 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Transfer Quantities by Route
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Units scheduled for dispatch between donor and recipient hospitals
            </p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={filteredTransfers.map((t) => ({
              name: `${t.from.split(" ")[0]} → ${t.to.split(" ")[0]}`,
              qty: t.quantity,
              score: t.score,
              medicine: t.medicine,
            }))}
            margin={{ top: 10, right: 10, bottom: 15, left: -10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg dark:bg-slate-900 dark:border-slate-800">
                      <p className="font-bold text-slate-900 dark:text-slate-100">{d.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{d.medicine}</p>
                      <div className="mt-1 flex items-center justify-between gap-4 font-semibold">
                        <span className="text-slate-600 dark:text-slate-400">Volume:</span>
                        <span className="text-sky-600 font-bold">{d.qty.toLocaleString()} units</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-slate-500 text-[11px] dark:text-slate-400">
                        <span>Route Score:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{d.score}/100</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="qty" radius={[4, 4, 0, 0]} fill="#0284c7" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Interactive Filters & Organization Scope Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1 text-xs dark:bg-slate-900 dark:border-slate-800">
          <button
            onClick={() => setScopeMode("my-org")}
            className={`rounded-md px-3 py-1 font-semibold transition-colors ${
              scopeMode === "my-org" ? "bg-indigo-600 text-white" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            My Hospital Routes
          </button>
          <button
            onClick={() => setScopeMode("incoming")}
            className={`rounded-md px-3 py-1 font-semibold transition-colors ${
              scopeMode === "incoming" ? "bg-emerald-600 text-white" : "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300"
            }`}
          >
            Incoming Deliveries
          </button>
          <button
            onClick={() => setScopeMode("outgoing")}
            className={`rounded-md px-3 py-1 font-semibold transition-colors ${
              scopeMode === "outgoing" ? "bg-sky-600 text-white" : "text-sky-700 hover:bg-sky-50 dark:text-sky-300"
            }`}
          >
            Outgoing Surplus
          </button>
          <button
            onClick={() => setScopeMode("all")}
            className={`rounded-md px-3 py-1 font-semibold transition-colors ${
              scopeMode === "all" ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            All Regional ({transfers.length})
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search transfer routes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 rounded-xl border border-slate-200 bg-white pl-8 pr-7 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:text-slate-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Transfer Recommendation Cards */}
      <div className="grid gap-4">
        {filteredTransfers.map((t) => {
          const isApproved = approvedIds.has(t.id);

          return (
            <div
              key={t.id}
              className={`rounded-2xl border p-5 shadow-sm transition-all duration-200 ${
                isApproved
                  ? "border-emerald-300 bg-gradient-to-r from-emerald-50/40 via-white to-emerald-50/20 dark:border-emerald-700"
                  : "border-slate-200 bg-white hover:border-sky-300 hover:shadow-md dark:bg-slate-900 dark:border-slate-800"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Route #{t.id.toUpperCase()}</span>
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-extrabold text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                        Score {t.score}/100
                      </span>
                      {isApproved && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 flex items-center gap-1 dark:bg-emerald-950 dark:text-emerald-200">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          <span>Approved &amp; Scheduled</span>
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="font-bold text-slate-900 text-sm dark:text-slate-100">{t.from}</span>
                      <ArrowRight className="h-4 w-4 text-sky-600 shrink-0" />
                      <span className="font-bold text-indigo-700 text-sm dark:text-indigo-300">{t.to}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => handleApprove(t.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all active:scale-95 ${
                      isApproved
                        ? "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:text-emerald-200 dark:border-emerald-700"
                        : "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700"
                    }`}
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    <span>{isApproved ? "Approved ✓" : "Approve Transfer"}</span>
                  </button>
                </div>
              </div>

              {/* Transfer Cargo details */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                    {t.quantity.toLocaleString()} units
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{t.medicine}</span>
                </div>
                <div className="flex items-center gap-4 text-slate-500 text-[11px] dark:text-slate-400">
                  <span>Logistics Protocol: Urgent Peer Transfer</span>
                </div>
              </div>

              {/* Rationale Checklist */}
              <div className="mt-3 rounded-xl bg-slate-50/80 p-3 dark:bg-slate-900/80">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Algorithmic Rationale &amp; Safety Checks:
                </span>
                <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  {t.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
