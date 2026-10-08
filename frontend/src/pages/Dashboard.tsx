const SECTIONS = [
  "Critical Shortages",
  "Demand Forecast",
  "Inventory Status",
  "Expiry Risk",
  "Redistribution Recommendations",
  "Priority Facilities",
];

/** Dashboard placeholder: titles for the 6 future sections, no hard-coded metrics.
 * KPI cards + live sections arrive in the Dashboard-integration task. */
export default function Dashboard() {
  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Dashboard</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <section key={s} className="rounded border border-gray-200 bg-white p-4">
            <h3 className="font-semibold text-gray-800">{s}</h3>
            <p className="mt-1 text-sm text-gray-500">Coming in the Dashboard-integration task.</p>
          </section>
        ))}
      </div>
    </div>
  );
}
