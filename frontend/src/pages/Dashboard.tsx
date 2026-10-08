import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, demoState, riskOf, type InventoryRow, type ForecastRow } from "../api/client";
import DemoBadge from "../components/DemoBadge";
import RiskBadge from "../components/RiskBadge";
import { useHospital } from "../context/HospitalContext";

const SCENARIOS = [
  { id: "normal", name: "Normal Operation" },
  { id: "outbreak", name: "Outbreak (+70% Demand)" },
  { id: "delay", name: "Supplier Delay (+5d)" },
  { id: "crisis", name: "Combined Crisis" },
];

export default function Dashboard() {
  const { activeHospitalId, activeHospital, isNetworkView } = useHospital();

  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [forecasts, setForecasts] = useState<ForecastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [scenario, setScenario] = useState("normal");
  const [selectedTransfer, setSelectedTransfer] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([api.getInventory(), api.getForecast()])
      .then(([invData, fcData]) => {
        setInventory(invData);
        setForecasts(fcData);
        setIsDemo(demoState.active);
      })
      .catch((err) => console.error("Dashboard error:", err))
      .finally(() => setLoading(false));
  }, []);

  // Filter dataset by active hospital account scope
  const scopedInventory = isNetworkView
    ? inventory
    : inventory.filter((r) => r.hospital_id === activeHospitalId);

  const scopedForecasts = isNetworkView
    ? forecasts
    : forecasts.filter((f) => f.hospital_id === activeHospitalId);

  const criticalItems = scopedInventory.filter((r) => riskOf(r.days_left) === "Critical");
  const highRiskItems = scopedInventory.filter((r) => riskOf(r.days_left) === "High");
  const expiringSoon = scopedInventory.filter((r) => {
    const days = Math.floor((new Date(r.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days <= 30;
  });

  // transfers mock dataset with hospital mapping
  const allTransfers = [
    {
      id: 1,
      from: "Riverside District Hospital",
      fromId: "h2",
      to: "City General Hospital",
      toId: "h1",
      medicine: "Amoxicillin",
      qty: 1200,
      distanceKm: 18,
      urgency: "High",
      why: "City General runs out in 2.1 days. Riverside has 8,000 units surplus.",
    },
    {
      id: 2,
      from: "St. Mary's Tertiary Care",
      fromId: "h3",
      to: "Riverside District Hospital",
      toId: "h2",
      medicine: "Insulin Glargine",
      qty: 400,
      distanceKm: 24,
      urgency: "Critical",
      why: "Riverside has 0 units in stock. St. Mary's has 1,200 units available.",
    },
    {
      id: 3,
      from: "Riverside District Hospital",
      fromId: "h2",
      to: "Lakeside Community Clinic",
      toId: "h4",
      medicine: "Paracetamol",
      qty: 800,
      distanceKm: 12,
      urgency: "Medium",
      why: "Lakeside runs out in 6.3 days. Transfer resolves stockout risk.",
    },
    {
      id: 4,
      from: "St. Mary's Tertiary Care",
      fromId: "h3",
      to: "City General Hospital",
      toId: "h1",
      medicine: "Insulin Glargine",
      qty: 250,
      distanceKm: 20,
      urgency: "Critical",
      why: "City General runs out in 3.7 days. St. Mary's has available inventory batch.",
    },
  ];

  // Scoped transfers (incoming or outgoing for the selected hospital account)
  const scopedTransfers = isNetworkView
    ? allTransfers
    : allTransfers.filter((t) => t.fromId === activeHospitalId || t.toId === activeHospitalId);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <span>Loading Facility Intelligence Dashboard…</span>
        </div>
      </div>
    );
  }

  const facilityName = isNetworkView ? "All Regional Facilities" : activeHospital?.name;

  return (
    <div className="space-y-6">
      {/* Facility Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-xs font-semibold text-indigo-300 ring-1 ring-inset ring-indigo-400/30">
              {isNetworkView ? "🌐 Network Admin View" : `🏥 ${activeHospital?.name}`}
            </span>
            {isDemo && <DemoBadge />}
          </div>
          <h2 className="mt-2 font-['Outfit',sans-serif] text-2xl font-bold tracking-tight">
            {facilityName} Dashboard
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            {isNetworkView
              ? "Regional medical supply early warning & network redistribution optimizer."
              : `Facility-scoped stock monitoring, consumption forecasting & transfer actions for ${activeHospital?.name}.`}
          </p>
        </div>

        {/* Scenario Toggle */}
        <div className="flex flex-col gap-1 sm:items-end">
          <span className="text-xs font-medium text-slate-300">Simulator Scenario:</span>
          <div className="flex flex-wrap gap-1 rounded-xl bg-slate-800/80 p-1 border border-slate-700/60">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => setScenario(s.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                  scenario === s.id
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards Grid (Scoped to Hospital) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {isNetworkView ? "Monitored Facilities" : "Account Scope"}
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">🏥</span>
          </div>
          <p className="mt-2 font-['Outfit',sans-serif] text-xl font-bold text-slate-900 truncate">
            {isNetworkView ? "4 Hospitals" : activeHospital?.name}
          </p>
          <p className="mt-1 text-xs text-slate-500">{activeHospital?.type ?? "Network Overview"}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tracked Medicine Batches</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">📦</span>
          </div>
          <p className="mt-2 font-['Outfit',sans-serif] text-3xl font-bold text-slate-900">{scopedInventory.length}</p>
          <p className="mt-1 text-xs text-slate-500">Facility inventory records</p>
        </div>

        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/50 p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">Critical Shortages</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">🚨</span>
          </div>
          <p className="mt-2 font-['Outfit',sans-serif] text-3xl font-bold text-rose-900">{criticalItems.length}</p>
          <p className="mt-1 text-xs text-rose-600">Runs out in &lt; 3 days</p>
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-5 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Expiry Risk Batches</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">⏳</span>
          </div>
          <p className="mt-2 font-['Outfit',sans-serif] text-3xl font-bold text-amber-900">{expiringSoon.length}</p>
          <p className="mt-1 text-xs text-amber-600">Expiring within 30 days</p>
        </div>
      </div>

      {/* Main Grid: Alerts + Recommendations */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Scoped Hospital Alerts (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-['Outfit',sans-serif] text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>🚨</span> Critical Shortages — {facilityName}
                </h3>
                <p className="text-xs text-slate-500">Medicines facing imminent stockouts at this facility</p>
              </div>
              <Link to="/inventory" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                View full facility inventory →
              </Link>
            </div>

            {criticalItems.concat(highRiskItems).length === 0 ? (
              <div className="p-6 text-center text-xs text-emerald-700 bg-emerald-50/50 rounded-xl border border-emerald-200/80">
                ✅ No critical shortages currently flagged for {facilityName}.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {criticalItems.concat(highRiskItems).slice(0, 6).map((item) => (
                  <div key={`${item.hospital_id}-${item.medicine_id}`} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{item.medicine}</p>
                      <p className="text-xs text-slate-500 truncate">{item.hospital}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-semibold text-slate-900">{item.current_quantity.toLocaleString()} units</p>
                        <p className="text-[11px] text-slate-500">
                          {item.days_left != null ? `${item.days_left.toFixed(1)} days left` : 'No stock'}
                        </p>
                      </div>
                      <RiskBadge level={riskOf(item.days_left)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Forecast Spikes for Scoped Hospital */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-['Outfit',sans-serif] text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>📈</span> Demand Forecast Spikes — {facilityName}
                </h3>
                <p className="text-xs text-slate-500">Predicted daily demand and growth rate</p>
              </div>
              <Link to="/forecast" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                View detailed forecast chart →
              </Link>
            </div>

            {scopedForecasts.length === 0 ? (
              <p className="text-xs text-slate-500 p-4">Select a medicine in the forecast page to generate predictions.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {scopedForecasts.map((f) => (
                  <div key={`${f.hospital_id}-${f.medicine_id}`} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600 truncate">{f.hospital_name}</span>
                      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${f.trend_growth_pct > 15 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        +{f.trend_growth_pct.toFixed(1)}% ↑
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-900">{f.medicine_name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Predicted: <span className="font-semibold text-slate-800">{f.predicted_daily_demand.toFixed(0)}</span> units/day
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Hospital-Scoped Transfers Sidebar */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-b from-indigo-50/50 to-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-['Outfit',sans-serif] text-base font-bold text-slate-900 flex items-center gap-2">
                <span>🔄</span> Facility Redistribution
              </h3>
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
                OR-Tools LP
              </span>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              {isNetworkView
                ? "All active network transfer recommendations."
                : `Transfers allocated for ${activeHospital?.name} (Incoming & Outgoing).`}
            </p>

            {scopedTransfers.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                No active transfer requests for this facility.
              </div>
            ) : (
              <div className="space-y-3">
                {scopedTransfers.map((t) => {
                  const isIncoming = t.toId === activeHospitalId;
                  const isOutgoing = t.fromId === activeHospitalId;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTransfer(selectedTransfer === t.id ? null : t.id)}
                      className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                        selectedTransfer === t.id
                          ? "border-indigo-500 bg-indigo-50/80 ring-2 ring-indigo-500/20 shadow-sm"
                          : "border-slate-200/80 bg-white hover:border-indigo-300"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span className="flex items-center gap-1 text-indigo-600 font-bold">
                          {t.medicine}
                        </span>
                        <div className="flex items-center gap-1">
                          {!isNetworkView && isIncoming && (
                            <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[10px] font-bold">
                              INCOMING ↓
                            </span>
                          )}
                          {!isNetworkView && isOutgoing && (
                            <span className="rounded bg-blue-100 text-blue-800 px-1.5 py-0.5 text-[10px] font-bold">
                              OUTGOING ↑
                            </span>
                          )}
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">
                            {t.qty.toLocaleString()} units
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-slate-600 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">From:</span>
                          <span className={`font-medium truncate ${isOutgoing ? 'text-indigo-700 font-bold' : 'text-slate-800'}`}>
                            {t.from}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">To:</span>
                          <span className={`font-medium truncate ${isIncoming ? 'text-indigo-700 font-bold' : 'text-slate-800'}`}>
                            {t.to}
                          </span>
                        </div>
                      </div>

                      {/* Why This Action Card */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg">
                        <span className="font-semibold text-indigo-900">WHY THIS ACTION:</span> {t.why}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Link
              to="/redistribution"
              className="mt-4 block w-full text-center rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-all"
            >
              Run Redistribution Optimizer
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


