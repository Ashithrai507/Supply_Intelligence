import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DEMO_INVENTORY } from "../api/mockData";

function daysToExpiry(expiryDate: string): number {
  return Math.floor((new Date(expiryDate).getTime() - Date.now()) / 86400000);
}

/** Expiry detail: expected use vs stock → surplus units likely wasted. */
export default function Expiry() {
  const rows = useMemo(
    () =>
      DEMO_INVENTORY.map((r) => {
        const dte = daysToExpiry(r.expiry_date);
        const expectedUse = Math.round(r.avg_daily_usage * Math.max(dte, 0));
        const surplus = Math.max(0, r.current_quantity - expectedUse);
        return { ...r, dte, expectedUse, surplus };
      })
        .filter((r) => r.surplus > 0)
        .sort((a, b) => b.surplus - a.surplus),
    [],
  );

  const totalWaste = rows.reduce((s, r) => s + r.surplus, 0);

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Expiry and Wastage</h2>
        <p className="text-sm text-gray-600">{totalWaste.toLocaleString()} units at risk total</p>
      </div>

      <div className="mb-4 rounded border border-gray-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Units likely to expire unused</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={rows.map((r) => ({
              name: `${r.hospital.split(" ")[0]} ${r.medicine.split(" ")[0]}`,
              surplus: r.surplus,
            }))}
            margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} height={60} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="surplus" name="Units at risk" fill="#ea580c" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <div key={`${r.hospital_id}-${r.medicine_id}`} className="rounded border border-gray-200 bg-white p-4">
            <h3 className="font-semibold">{r.hospital}</h3>
            <p className="text-sm text-gray-600">{r.medicine} — expires in {r.dte} days</p>
            <div className="mt-2 h-3 overflow-hidden rounded bg-gray-200">
              <div
                className="h-full bg-orange-500"
                style={{ width: `${Math.min(100, (r.surplus / r.current_quantity) * 100)}%` }}
              />
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-1 text-sm">
              <dt className="text-gray-500">Current stock</dt>
              <dd className="text-right font-medium">{r.current_quantity.toLocaleString()}</dd>
              <dt className="text-gray-500">Expected use before expiry</dt>
              <dd className="text-right font-medium">{r.expectedUse.toLocaleString()}</dd>
              <dt className="text-gray-500">Likely wasted</dt>
              <dd className="text-right font-semibold text-orange-700">{r.surplus.toLocaleString()} units</dd>
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
