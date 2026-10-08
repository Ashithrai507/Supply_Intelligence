import { Link } from "react-router-dom";
import { riskOf } from "../api/client";
import { DEMO_FORECASTS, DEMO_INVENTORY, DEMO_PRIORITIES, DEMO_TRANSFERS } from "../api/mockData";

function daysToExpiry(expiryDate: string): number {
  return Math.floor((new Date(expiryDate).getTime() - Date.now()) / 86400000);
}

/** Dashboard overview: six clickable cards into the decision-flow detail pages.
 * Counts derive from the same filler data the pages render (live API later). */
export default function Dashboard() {
  const critical = DEMO_INVENTORY.filter((r) => riskOf(r.days_left) === "Critical").length;
  const atRisk = DEMO_INVENTORY.filter((r) => (r.days_left ?? 999) <= 14).length;
  const expiry = DEMO_INVENTORY.filter((r) => daysToExpiry(r.expiry_date) <= 14).length;

  const cards = [
    { to: "/shortage-risk", title: "Critical Shortages", value: String(critical), hint: `${atRisk} items at risk within 14 days` },
    { to: "/forecast", title: "Demand Forecast", value: String(DEMO_FORECASTS.length), hint: "hospital-medicine forecasts tracked" },
    { to: "/inventory", title: "Inventory Status", value: String(DEMO_INVENTORY.length), hint: "hospital-medicine stock records" },
    { to: "/expiry-risk", title: "Expiry Risk", value: String(expiry), hint: "batches expiring within 14 days" },
    { to: "/redistribution", title: "Redistribution Recommendations", value: String(DEMO_TRANSFERS.length), hint: "proposed transfers" },
    { to: "/priority", title: "Priority Facilities", value: String(DEMO_PRIORITIES.length), hint: "hospitals ranked by need" },
  ];

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Dashboard</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="rounded border border-gray-200 bg-white p-4 transition hover:border-gray-400 hover:shadow"
          >
            <p className="text-3xl font-bold">{c.value}</p>
            <h3 className="mt-1 font-semibold text-gray-800 underline">{c.title}</h3>
            <p className="mt-1 text-sm text-gray-500">{c.hint}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
