/** Forecast-driven alerts strip (§17): real model-backed stock-out alerts.
 * Each alert deep-links to the medicine's forecast page. Hides itself when
 * the backend is unreachable so the rest of the dashboard keeps working. */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FlaskConical } from "lucide-react";
import { getDashboardAlerts, getHospitals, type DashboardAlert } from "../api/forecast";

export default function ForecastAlerts() {
  const [alerts, setAlerts] = useState<DashboardAlert[] | null>(null);
  const [hospitalId, setHospitalId] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    getHospitals(ctrl.signal)
      .then((h) => {
        if (h.length === 0) {
          setAlerts([]);
          return null;
        }
        setHospitalId(h[0].id);
        return getDashboardAlerts(h[0].id, ctrl.signal);
      })
      .then((a) => {
        if (a) setAlerts(a.slice(0, 4));
      })
      .catch(() => setAlerts(null));
    return () => ctrl.abort();
  }, []);

  if (!alerts || alerts.length === 0) return null;

  return (
    <section aria-label="Forecast-driven alerts" className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <FlaskConical className="h-4 w-4 text-indigo-600" />
        Forecast-driven alerts (LightGBM)
      </h2>
      <ul className="mt-2 divide-y divide-slate-100">
        {alerts.map((a) => (
          <li key={`${a.medicine_id}`}>
            <Link
              to={`/forecast?hospital=${encodeURIComponent(hospitalId)}&medicine=${encodeURIComponent(a.medicine_id)}`}
              className="flex items-center justify-between py-2 hover:bg-slate-50"
            >
              <span className="text-sm font-semibold">{a.medicine_name}</span>
              <span className="text-xs text-slate-600">
                Stock-out expected in{" "}
                <strong>{a.days_until_stockout != null ? `${a.days_until_stockout} days` : "—"}</strong>
                {" · "}{a.risk_level}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
