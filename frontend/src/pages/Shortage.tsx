import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { riskOf } from "../api/client";
import { DEMO_INVENTORY } from "../api/mockData";
import RiskBadge from "../components/RiskBadge";

const BAR_COLORS: Record<string, string> = {
  Critical: "#dc2626",
  High: "#ea580c",
  Medium: "#ca8a04",
  Safe: "#16a34a",
};

/** Critical Shortages detail: who runs out, when, and whether procurement can cover it. */
export default function Shortage() {
  const atRisk = useMemo(
    () =>
      DEMO_INVENTORY.filter((r) => (r.days_left ?? 999) <= 14).sort(
        (a, b) => (a.days_left ?? 999) - (b.days_left ?? 999),
      ),
    [],
  );

  const chartData = atRisk.slice(0, 8).map((r) => ({
    name: `${r.hospital.split(" ")[0]} ${r.medicine.split(" ")[0]}`,
    days: r.days_left ?? 0,
    level: riskOf(r.days_left),
  }));

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Critical Shortages</h2>

      <div className="mb-4 rounded border border-gray-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Days left by item (lowest first)</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} height={60} />
            <YAxis tick={{ fontSize: 11 }} label={{ value: "days", angle: -90, fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="days" name="Days left">
              {chartData.map((c) => (
                <Cell key={c.name} fill={BAR_COLORS[c.level]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {atRisk.map((r) => {
          const level = riskOf(r.days_left);
          const covered = (r.days_left ?? 0) > r.supplier_lead_time_days;
          return (
            <div key={`${r.hospital_id}-${r.medicine_id}`} className="rounded border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{r.hospital}</h3>
                <RiskBadge level={level} />
              </div>
              <p className="text-sm text-gray-600">{r.medicine}</p>
              <dl className="mt-2 grid grid-cols-2 gap-1 text-sm">
                <dt className="text-gray-500">Stock</dt>
                <dd className="text-right font-medium">{r.current_quantity.toLocaleString()}</dd>
                <dt className="text-gray-500">Days left</dt>
                <dd className="text-right font-medium">{(r.days_left ?? 0).toFixed(1)}</dd>
                <dt className="text-gray-500">Supplier lead time</dt>
                <dd className="text-right font-medium">{r.supplier_lead_time_days} days</dd>
              </dl>
              <p className={`mt-2 rounded px-2 py-1 text-xs font-semibold ${covered ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                {covered
                  ? "Normal procurement can cover this — order now."
                  : "Procurement cannot cover this — stock-out before resupply. Redistribute."}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
