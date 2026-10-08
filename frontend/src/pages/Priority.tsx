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
import { DEMO_PRIORITIES } from "../api/mockData";
import RiskBadge from "../components/RiskBadge";

const BAR_COLORS: Record<string, string> = {
  Critical: "#dc2626",
  High: "#ea580c",
  Medium: "#ca8a04",
};

const DIMENSIONS = [
  { key: "patientLoad", label: "Patient load" },
  { key: "emergency", label: "Emergency demand" },
  { key: "stockout", label: "Stock-out risk" },
  { key: "criticality", label: "Criticality" },
  { key: "alternatives", label: "No alternative" },
] as const;

/** Priority detail: ranked hospitals with score breakdown and WHY. */
export default function Priority() {
  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Priority Facilities</h2>

      <div className="mb-4 rounded border border-gray-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Priority scores</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={DEMO_PRIORITIES.map((p) => ({ name: p.hospital.split(" ")[0], score: p.score, level: p.level }))}
            layout="vertical"
            margin={{ top: 5, right: 10, bottom: 5, left: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
            <Tooltip />
            <Bar dataKey="score" name="Score">
              {DEMO_PRIORITIES.map((p) => (
                <Cell key={p.hospital_id} fill={BAR_COLORS[p.level]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ol className="grid gap-3">
        {DEMO_PRIORITIES.map((p, i) => (
          <li key={p.hospital_id} className="rounded border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">
                <span className="mr-2 text-gray-400">#{i + 1}</span>
                {p.hospital} — {p.score}/100
              </h3>
              <RiskBadge level={p.level === "Critical" ? "Critical" : p.level === "High" ? "High" : "Medium"} />
            </div>
            <p className="mt-1 text-sm text-gray-600">Why: {p.reason}</p>
            <div className="mt-2 space-y-1">
              {DIMENSIONS.map((d) => (
                <div key={d.key} className="flex items-center gap-2 text-xs">
                  <span className="w-28 shrink-0 text-gray-500">{d.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded bg-gray-200">
                    <div className="h-full bg-gray-700" style={{ width: `${(p.breakdown[d.key] / 30) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-gray-600">{p.breakdown[d.key]}</span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
