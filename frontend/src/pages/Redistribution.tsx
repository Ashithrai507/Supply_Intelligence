import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DEMO_TRANSFERS } from "../api/mockData";

/** Redistribution detail: recommended transfers with reasons. */
export default function Redistribution() {
  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Redistribution Recommendations</h2>

      <div className="mb-4 rounded border border-gray-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Transfer quantities</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={DEMO_TRANSFERS.map((t) => ({ name: `${t.from.split(" ")[0]} to ${t.to.split(" ")[0]}`, qty: t.quantity }))}
            margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="qty" name="Units" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-3">
        {DEMO_TRANSFERS.map((t) => (
          <div key={t.id} className="rounded border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">
                {t.from} <span className="text-gray-400">→</span> {t.to}
              </h3>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                Score {t.score}/100
              </span>
            </div>
            <p className="mt-1 text-sm">
              <span className="font-semibold">{t.quantity.toLocaleString()} units</span> of {t.medicine}
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-gray-600">
              {t.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
