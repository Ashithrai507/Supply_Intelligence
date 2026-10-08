import type { DemoOffer, TrafficLevel } from "../api/mockData";

const TRAFFIC_COLOR: Record<TrafficLevel, string> = {
  Low: "#16a34a",
  Moderate: "#d97706",
  Heavy: "#dc2626",
};

function shortName(name: string): string {
  return name.replace("Hospital", "H").replace("District", "").replace("Tertiary Care", "").replace("Community Clinic", "").trim();
}

/** Schematic route map: requester at center, donor routes around it.
 * Line color = traffic, dashed = needs pickup. Filler geometry, clearly labeled
 * schematic — swap for Leaflet + live traffic when a routing API lands. */
export default function OfferMap({
  requester,
  offers,
}: {
  requester: string;
  offers: DemoOffer[];
}) {
  const W = 320;
  const H = 200;
  const cx = W / 2;
  const cy = H / 2 + 6;
  const R = 68;

  const placed = offers.slice(0, 6).map((o, i, arr) => {
    const angle = arr.length === 1 ? -Math.PI / 2 : Math.PI * (0.15 + (0.7 * i) / Math.max(arr.length - 1, 1)) * -1;
    return { offer: o, x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) * 0.72 };
  });

  if (placed.length === 0) {
    return <p className="text-sm text-gray-500">No donor routes to show yet.</p>;
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded border border-gray-200 bg-slate-50" role="img" aria-label={`Route map for ${requester}`}>
        {placed.map(({ offer: o, x, y }) => {
          const color = TRAFFIC_COLOR[o.traffic];
          const mx = (cx + x) / 2;
          const my = (cy + y) / 2 - 8;
          return (
            <g key={o.id}>
              <line
                x1={cx} y1={cy} x2={x} y2={y}
                stroke={color} strokeWidth={2.5}
                strokeDasharray={o.canTransportImmediately ? undefined : "5 4"}
                opacity={0.85}
              />
              <text x={mx} y={my} textAnchor="middle" fontSize={9} fill="#334155" fontWeight={600}>
                {o.distanceKm}km · {o.travelMinutes}min · {o.traffic}
              </text>
              <circle cx={x} cy={y} r={11} fill="#fff" stroke={color} strokeWidth={2.5} />
              <text x={x} y={y + 3} textAnchor="middle" fontSize={8} fontWeight={700} fill="#1f2937">
                {shortName(o.donor).slice(0, 6)}
              </text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={14} fill="#1f2937" />
        <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={8} fontWeight={700} fill="#fff">
          {shortName(requester).slice(0, 6)}
        </text>
      </svg>
      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-600">
        <span><span className="mr-1 inline-block h-2 w-4 rounded bg-green-600 align-middle" />Low traffic</span>
        <span><span className="mr-1 inline-block h-2 w-4 rounded bg-amber-600 align-middle" />Moderate</span>
        <span><span className="mr-1 inline-block h-2 w-4 rounded bg-red-600 align-middle" />Heavy</span>
        <span className="ml-auto">Schematic — not to scale; traffic is filler data</span>
      </div>
    </div>
  );
}
