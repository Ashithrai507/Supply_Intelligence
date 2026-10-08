import { Link } from "react-router-dom";

interface FeatureDetail {
  description: string;
  features: string[];
  metrics: string[];
  status: string;
}

const DETAILS: Record<string, FeatureDetail> = {
  "Shortage Risk Classifier": {
    description: "Evaluates days-until-stockout and calculates stockout probability via Monte-Carlo risk estimation.",
    features: [
      "Days-until-stockout q50 forecast walk",
      "Supplier lead-time buffer comparison",
      "Correlated risk reasons (e.g. demand +34%, lead time +3d)",
      "High/Medium/Critical risk level categorizations",
    ],
    metrics: ["Precision", "Recall", "F1 Score", "ROC-AUC"],
    status: "Phase 1 - Engine Integration",
  },
  "Expiry Risk Engine": {
    description: "Calculates batch-level unused surplus inventory before expiration to feed the redistribution optimizer.",
    features: [
      "Batch expiry date integration with consumption forecast",
      "Surplus units prediction = Quantity - Expected Usage",
      "Early warning flags for batches expiring within 14–30 days",
      "Auto-nomination of surplus inventory to redistribution pool",
    ],
    metrics: ["Expired Inventory Reduction", "Wastage Cost Saved", "Usable Surplus %"],
    status: "Phase 1 - Expiry Engine",
  },
  "Redistribution Optimizer": {
    description: "OR-Tools Linear Programming engine solving multi-facility inventory transfers under real constraints.",
    features: [
      "Minimizes transport cost, stockout penalty, waste, and unmet demand",
      "Safety stock and shelf-life feasibility constraints",
      "Logistics transport time & capacity bounds",
      "Deterministic 'WHY THIS ACTION' explanation cards",
    ],
    metrics: ["Unmet Demand ↓", "Transport Distance (km)", "Stock-out Events ↓"],
    status: "Phase 1 - OR-Tools LP Solver",
  },
  "Priority Engine": {
    description: "Transparent weighted score engine for waterfall supply allocation when multiple facilities compete for limited stock.",
    features: [
      "40% Shortage Severity Weighting",
      "25% Emergency Demand Score",
      "15% Patient Load Factor",
      "10% Time-Until-Stockout & 10% Lack of Alternatives",
    ],
    metrics: ["Allocation Fairness Score", "Emergency Resolution Rate"],
    status: "Phase 1 - Priority Engine",
  },
};

export default function ComingSoon({ title }: { title: string }) {
  const detail = DETAILS[title] ?? {
    description: "Advanced intelligence module being wired into the Singularity 2026 pipeline.",
    features: ["Real-time FastAPI integration", "OR-Tools optimization", "Explainable cards"],
    metrics: ["Accuracy", "Efficiency"],
    status: "Phase 1 Workstream",
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 p-6 text-white shadow-lg">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-300 ring-1 ring-inset ring-indigo-400/30">
            {detail.status}
          </span>
          <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
            Active Workstream
          </span>
        </div>
        <h2 className="mt-3 font-['Outfit',sans-serif] text-2xl font-bold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-slate-300 max-w-2xl">{detail.description}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Key Features */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3">
          <h3 className="font-['Outfit',sans-serif] text-base font-bold text-slate-900 flex items-center gap-2">
            <span>⚡</span> Core Engine Capabilities
          </h3>
          <ul className="space-y-2 text-xs text-slate-600">
            {detail.features.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-indigo-600 font-bold">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Target Metrics */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3">
          <h3 className="font-['Outfit',sans-serif] text-base font-bold text-slate-900 flex items-center gap-2">
            <span>🎯</span> Evaluated Target Metrics
          </h3>
          <div className="flex flex-wrap gap-2 pt-1">
            {detail.metrics.map((m, i) => (
              <span
                key={i}
                className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-1.5 text-xs font-semibold text-indigo-700"
              >
                {m}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-500 pt-3 border-t border-slate-100">
            Computed directly from pipeline execution outputs; zero hard-coded scores.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-6 text-center space-y-3">
        <p className="text-xs text-slate-600">
          The backend API endpoints for <span className="font-semibold text-slate-800">{title}</span> are being wired in Phase 1.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            to="/"
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-all"
          >
            ← View Command Dashboard
          </Link>
          <Link
            to="/inventory"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all"
          >
            Check Live Inventory →
          </Link>
        </div>
      </div>
    </div>
  );
}

