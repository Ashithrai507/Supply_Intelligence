import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Boxes,
  Building2,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Truck,
} from "lucide-react";
import { riskOf, type InventoryRow } from "../api/client";
import {
  getInventoryRows,
  getNetworkPriorities,
  getTransferRows,
  type PriorityRow,
  type TransferRow,
} from "../api/medpredict";
import { DEMO_REQUESTS } from "../api/mockData";
import { useAuth } from "../context/AuthContext";
import ForecastAlerts from "../components/ForecastAlerts";
import RiskBadge from "../components/RiskBadge";

function daysToExpiry(expiryDate: string): number {
  return Math.floor((new Date(expiryDate).getTime() - Date.now()) / 86400000);
}

export default function Dashboard() {
  const { user } = useAuth();
  const currentHospitalName = user?.name ?? "Hospital A";

  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [priorities, setPriorities] = useState<PriorityRow[]>([]);
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    Promise.all([
      getInventoryRows(user.id),
      getNetworkPriorities(),
      getTransferRows(user.id),
    ])
      .then(([inv, prio, trans]) => {
        setInventory(inv);
        setPriorities(prio);
        setTransfers(trans);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [user?.id]);

  // Data is already scoped to the authenticated facility by the API.
  const scopedInventory = useMemo(
    () => inventory.filter((r) => r.hospital === currentHospitalName || r.hospital_id === user?.id),
    [inventory, currentHospitalName, user],
  );

  const scopedTransfers = useMemo(
    () =>
      transfers.filter(
        (t) => t.from === currentHospitalName || t.to === currentHospitalName,
      ),
    [transfers, currentHospitalName],
  );

  const scopedPriority = useMemo(
    () => priorities.find((p) => p.hospital === currentHospitalName),
    [priorities, currentHospitalName],
  );

  const critical = scopedInventory.filter((r) => riskOf(r.days_left) === "Critical");
  const atRisk = scopedInventory.filter((r) => (r.days_left ?? 999) <= 14).length;
  const expiry = scopedInventory.filter((r) => daysToExpiry(r.expiry_date) <= 14).length;

  const totalStockUnits = scopedInventory.reduce((acc, r) => acc + r.current_quantity, 0);

  const cards = [
    {
      to: "/shortage-risk",
      title: "Critical Shortages",
      value: String(critical.length),
      hint: `${atRisk} medicines under 14 days of supply`,
      accent: "rose",
      gradient: "from-rose-500 to-red-600",
      iconBg: "bg-rose-500 text-white",
      badgeText: critical.length > 0 ? "Action Required" : "All Clear",
      badgeColor:
        critical.length > 0
          ? "bg-rose-100 text-rose-700 border-rose-200"
          : "bg-emerald-100 text-emerald-700 border-emerald-200",
      icon: AlertTriangle,
    },
    {
      to: "/forecast",
      title: "Demand Projections",
      value: String(scopedInventory.length),
      hint: "AI predictive surge models active for your facility",
      accent: "indigo",
      gradient: "from-indigo-500 to-blue-600",
      iconBg: "bg-indigo-600 text-white",
      badgeText: "AI 14-Day Model",
      badgeColor: "bg-indigo-100 text-indigo-700 border-indigo-200",
      icon: TrendingUp,
    },
    {
      to: "/inventory",
      title: "Facility Stock Units",
      value: `${(totalStockUnits / 1000).toFixed(1)}k`,
      hint: `${scopedInventory.length} medicines monitored in your formulary`,
      accent: "emerald",
      gradient: "from-emerald-500 to-teal-600",
      iconBg: "bg-emerald-600 text-white",
      badgeText: "Real-time Telemetry",
      badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
      icon: Boxes,
    },
    {
      to: "/expiry-risk",
      title: "Expiry & Wastage Risk",
      value: String(expiry),
      hint: "Formulary batches expiring in ≤14 days",
      accent: "amber",
      gradient: "from-amber-500 to-orange-600",
      iconBg: "bg-amber-500 text-white",
      badgeText: "Surplus Detection",
      badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
      icon: CalendarClock,
    },
    {
      to: "/redistribution",
      title: "Active Transfers",
      value: String(scopedTransfers.length),
      hint: "Incoming or outgoing peer shipments",
      accent: "sky",
      gradient: "from-sky-500 to-blue-600",
      iconBg: "bg-sky-600 text-white",
      badgeText: "Peer Net",
      badgeColor: "bg-sky-100 text-sky-800 border-sky-200",
      icon: ArrowLeftRight,
    },
    {
      to: "/priority",
      title: "Network Priority Score",
      value: scopedPriority ? `${scopedPriority.score}/100` : "75/100",
      hint: `Urgency tier: ${scopedPriority?.level ?? "Monitored"}`,
      accent: "purple",
      gradient: "from-purple-500 to-fuchsia-600",
      iconBg: "bg-purple-600 text-white",
      badgeText: scopedPriority?.level ?? "Active",
      badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
      icon: ShieldAlert,
    },
    {
      to: "/requests",
      title: "Supply Requests",
      value: String(DEMO_REQUESTS.filter((r) => r.status === "Pending").length),
      hint: `${DEMO_REQUESTS.length} facility requests logged`,
      accent: "teal",
      gradient: "from-teal-500 to-cyan-600",
      iconBg: "bg-teal-600 text-white",
      badgeText: "Facility Inbox",
      badgeColor: "bg-teal-100 text-teal-800 border-teal-200",
      icon: ClipboardList,
    },
  ];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm font-semibold text-slate-500">
        Loading facility telemetry…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6 text-rose-900 shadow-sm">
        <h3 className="font-bold">Could not load the dashboard</h3>
        <p className="mt-1 text-xs text-rose-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Organization Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl shadow-indigo-950/10">
        <div className="absolute -top-12 -right-12 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-12 -left-12 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/20 px-3 py-1 text-xs font-medium text-indigo-200 backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span>Organization Telemetry Scope • {user?.code ?? "FACILITY"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {currentHospitalName}
            </h1>
            <p className="text-sm text-slate-300">
              Welcome, <strong className="text-white">{user?.userName}</strong> ({user?.role}). Viewing inventory telemetry, risk signals, and redistribution recommendations scoped to your organization.
            </p>
          </div>

          {/* Hospital Profile Quick Pill */}
          <div className="rounded-xl border border-white/10 bg-white/10 p-3.5 backdrop-blur-md text-xs space-y-1.5 shrink-0">
            <div className="flex items-center gap-2 font-bold text-white">
              <Building2 className="h-4 w-4 text-cyan-400" />
              <span>{user?.tier ?? "Clinical Facility"}</span>
            </div>
            <p className="text-slate-300">
              Region: <strong className="text-white">{user?.region}</strong>
            </p>
            <p className="text-slate-300">
              Capacity: <strong className="text-white">{user?.bedCapacity} operational beds</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Reactive Emergency Stockout Alert Banner */}
      {critical.length > 0 && (
        <div className="relative overflow-hidden rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50 via-red-50 to-orange-50 p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-md shadow-rose-600/30">
                <AlertTriangle className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-600" />
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-rose-900">
                    Urgent Supply Depletion at {currentHospitalName}
                  </h3>
                  <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                    {critical.length} Critical Stockouts
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-rose-700">
                  {critical.map((c) => `${c.medicine} (${c.days_left?.toFixed(1)}d supply left)`).join(" • ")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <Link
                to="/redistribution"
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-rose-600/20 hover:bg-rose-700 transition-all active:scale-95"
              >
                <Truck className="h-3.5 w-3.5" />
                <span>Request Transfers</span>
              </Link>
              <Link
                to="/shortage-risk"
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100/60 transition-colors"
              >
                <span>View Details</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Main KPI Grid with Color Theming */}
      <ForecastAlerts />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.to}
              to={c.to}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg hover:shadow-slate-200/70"
            >
              <div
                className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${c.gradient} opacity-80 group-hover:opacity-100 transition-opacity`}
              />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.iconBg} shadow-sm group-hover:scale-105 transition-transform`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${c.badgeColor}`}>
                    {c.badgeText}
                  </span>
                </div>

                <p className="text-3xl font-extrabold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {c.value}
                </p>
                <h3 className="mt-1 text-sm font-bold text-slate-800">
                  {c.title}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {c.hint}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
                <span>View Organization Data</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Reactive Watchlist Panels */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scoped Shortages Watchlist */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-rose-100 p-1.5 text-rose-700">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">
                {currentHospitalName} Inventory Watchlist
              </h2>
            </div>
            <Link
              to="/inventory"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
            >
              <span>View full stock</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {scopedInventory
              .slice()
              .sort((a, b) => (a.days_left ?? 999) - (b.days_left ?? 999))
              .map((row) => {
                const level = riskOf(row.days_left);
                return (
                  <div
                    key={`${row.hospital_id}-${row.medicine_id}`}
                    className="flex items-center justify-between py-2.5 hover:bg-slate-50/80 px-2 rounded-lg transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">{row.medicine}</span>
                        <RiskBadge level={level} size="sm" />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Supplier: {row.supplier} (Lead: {row.supplier_lead_time_days}d)
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-900">
                        {row.days_left != null ? `${row.days_left.toFixed(1)} days` : "n/a"}
                      </span>
                      <p className="text-[10px] text-slate-500">
                        {row.current_quantity.toLocaleString()} in stock
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Peer Redistribution Recommendations for this Hospital */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-sky-100 p-1.5 text-sky-700">
                <Truck className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">
                Peer Redistribution Pipeline
              </h2>
            </div>
            <Link
              to="/redistribution"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
            >
              <span>Transfer manager</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {scopedTransfers.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No active transfers currently scheduled for {currentHospitalName}.
              </div>
            ) : (
              scopedTransfers.map((t) => {
                const isIncoming = t.to === currentHospitalName;
                return (
                  <div
                    key={t.id}
                    className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 hover:border-sky-200 hover:bg-white transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                          isIncoming
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {isIncoming ? "Incoming Shipment" : "Outgoing Donor"}
                      </span>
                      <span className="text-xs font-bold text-slate-700">Score {t.score}/100</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-900">
                          {t.quantity.toLocaleString()} units of {t.medicine}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {isIncoming ? `From ${t.from}` : `To ${t.to}`}
                        </p>
                      </div>
                      <Link
                        to="/redistribution"
                        className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        Manage
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
