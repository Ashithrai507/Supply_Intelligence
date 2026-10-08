import { NavLink, Route, Routes } from "react-router-dom";
import ComingSoon from "./pages/ComingSoon";
import Dashboard from "./pages/Dashboard";
import Forecast from "./pages/Forecast";
import Inventory from "./pages/Inventory";
import { useHospital } from "./context/HospitalContext";

const LINKS = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/inventory", label: "Inventory", icon: "📦" },
  { to: "/forecast", label: "Demand Forecast", icon: "📈" },
  { to: "/shortage-risk", label: "Shortage Risk", icon: "🚨" },
  { to: "/expiry-risk", label: "Expiry Risk", icon: "⏳" },
  { to: "/redistribution", label: "Redistribution", icon: "🔄" },
  { to: "/priority", label: "Priority", icon: "🎯" },
];

export default function App() {
  const { activeHospitalId, setActiveHospitalId, activeHospital, hospitals, isNetworkView } = useHospital();

  return (
    <div className="min-h-screen bg-slate-50/80 text-slate-800 flex flex-col font-['Inter',sans-serif]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md shadow-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-md shadow-indigo-500/20">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div>
                <h1 className="font-['Outfit',sans-serif] text-lg font-bold tracking-tight text-slate-900">
                  Supply<span className="text-indigo-600">Intelligence</span>
                </h1>
                <p className="text-[11px] font-medium text-slate-500">Facility Early Warning System</p>
              </div>
            </div>

            {/* Simulated Hospital Account Switcher */}
            <div className="flex items-center gap-2 rounded-xl bg-slate-100/80 p-1.5 border border-slate-200 text-xs">
              <span className="hidden md:inline font-medium text-slate-500 pl-1">
                Hospital Account:
              </span>
              <select
                value={activeHospitalId}
                onChange={(e) => setActiveHospitalId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none shadow-2xs"
              >
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>
                    🏥 {h.name}
                  </option>
                ))}
                <option value="all">🌐 All Facilities (Network View)</option>
              </select>

              <span className={`hidden sm:inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                isNetworkView ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'
              }`}>
                {isNetworkView ? 'Network Admin' : activeHospital?.type}
              </span>
            </div>
          </div>

          {/* Navigation Bar */}
          <nav className="flex space-x-1 overflow-x-auto pb-2 scrollbar-none border-t border-slate-100 pt-2">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                <span>{l.icon}</span>
                <span>{l.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Hospital Scope Bar Banner */}
      <div className="bg-indigo-900 text-white text-xs py-1.5 px-4 text-center flex items-center justify-center gap-2">
        <span className="font-bold">Active Account Perspective:</span>
        {isNetworkView ? (
          <span className="bg-purple-600/60 px-2 py-0.5 rounded text-purple-100 font-medium">
            🌐 Network Admin View (All Hospitals)
          </span>
        ) : (
          <span className="bg-indigo-700/80 px-2 py-0.5 rounded text-indigo-100 font-medium">
            🏥 {activeHospital?.name} — {activeHospital?.location} ({activeHospital?.role})
          </span>
        )}
      </div>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl w-full flex-1 px-4 sm:px-6 lg:px-8 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/shortage-risk" element={<ComingSoon title="Shortage Risk Classifier" />} />
          <Route path="/expiry-risk" element={<ComingSoon title="Expiry Risk Engine" />} />
          <Route path="/redistribution" element={<ComingSoon title="Redistribution Optimizer" />} />
          <Route path="/priority" element={<ComingSoon title="Priority Engine" />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-white py-4 text-center text-xs text-slate-500">
        Medical Supply Intelligence & Redistribution Network — Singularity 2026 Prototype
      </footer>
    </div>
  );
}


