import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Expiry from "./pages/Expiry";
import Forecast from "./pages/Forecast";
import Inventory from "./pages/Inventory";
import Priority from "./pages/Priority";
import Redistribution from "./pages/Redistribution";
import Shortage from "./pages/Shortage";

const LINKS = [
  { to: "/", label: "Dashboard" },
  { to: "/inventory", label: "Inventory" },
  { to: "/forecast", label: "Demand Forecast" },
  { to: "/shortage-risk", label: "Shortage Risk" },
  { to: "/expiry-risk", label: "Expiry Risk" },
  { to: "/redistribution", label: "Redistribution" },
  { to: "/priority", label: "Priority" },
];

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <h1 className="text-lg font-bold">Medical Supply Intelligence</h1>
          <nav className="mt-2 flex flex-wrap gap-1">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  `rounded px-2 py-1 text-sm ${
                    isActive ? "bg-gray-900 font-semibold text-white" : "text-gray-700 hover:bg-gray-200"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/shortage-risk" element={<Shortage />} />
          <Route path="/expiry-risk" element={<Expiry />} />
          <Route path="/redistribution" element={<Redistribution />} />
          <Route path="/priority" element={<Priority />} />
        </Routes>
      </main>
    </div>
  );
}
