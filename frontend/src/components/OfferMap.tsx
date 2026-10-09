import { Fragment, useMemo } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";
import type { DemoOffer, TrafficLevel } from "../api/mockData";
import { hospitalCoords } from "../api/mockData";

const TRAFFIC_COLOR: Record<TrafficLevel, string> = {
  Low: "#16a34a",
  Moderate: "#d97706",
  Heavy: "#dc2626",
};

/** Real map (Leaflet + OpenStreetMap): requester pin + donor routes.
 * Line color = traffic, dashed = needs pickup. Coordinates and traffic are
 * filler for now; road-snapped geometry + live traffic arrive with a routing API. */
export default function OfferMap({
  requester,
  offers,
}: {
  requester: string;
  offers: DemoOffer[];
}) {
  const center = useMemo(() => hospitalCoords(requester), [requester]);
  const bounds = useMemo(() => {
    const pts: Array<[number, number]> = [[center.lat, center.lng]];
    for (const o of offers.slice(0, 6)) {
      const c = hospitalCoords(o.donor);
      pts.push([c.lat, c.lng]);
    }
    return pts;
  }, [center, offers]);

  if (offers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white">
          <MapPin size={18} />
        </span>
        <p className="text-sm font-semibold text-slate-800">No donor routes yet</p>
        <p className="max-w-xs text-xs text-slate-500">
          Once hospitals offer help, their traffic-aware routes to {requester} will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="modal-map flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 shadow-sm">
      <div className="h-[240px] w-full sm:h-[300px] lg:h-[360px] xl:h-[400px]">
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [28, 28] }}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CircleMarker
          center={[center.lat, center.lng]}
          radius={10}
          pathOptions={{ color: "#0f172a", weight: 3, fillColor: "#0f172a", fillOpacity: 1 }}
        >
          <Popup><strong>{requester}</strong> (needs supply)</Popup>
        </CircleMarker>
        {offers.slice(0, 6).map((o) => {
          const d = hospitalCoords(o.donor);
          const color = TRAFFIC_COLOR[o.traffic];
          return (
            <Fragment key={o.id}>
              <Polyline
                positions={[[d.lat, d.lng], [center.lat, center.lng]]}
                pathOptions={{
                  color,
                  weight: 4,
                  opacity: 0.9,
                  dashArray: o.canTransportImmediately ? undefined : "7 6",
                }}
              >
                <Popup>
                  <strong>{o.donor} → {requester}</strong><br />
                  {o.distanceKm} km · {o.travelMinutes} min · {o.traffic} traffic<br />
                  {o.quantity.toLocaleString()} units ·{" "}
                  {o.canTransportImmediately ? "immediate transport" : "pickup needed"}
                </Popup>
              </Polyline>
              <CircleMarker
                center={[d.lat, d.lng]}
                radius={7}
                pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 1 }}
              >
                <Popup><strong>{o.donor}</strong> (donor)</Popup>
              </CircleMarker>
            </Fragment>
          );
        })}
      </MapContainer>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-slate-100 bg-white px-3 py-2 text-[11px] font-medium text-slate-600">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5">
          <span className="h-2 w-2 rounded-full bg-green-600" /> Low
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5">
          <span className="h-2 w-2 rounded-full bg-amber-600" /> Moderate
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5">
          <span className="h-2 w-2 rounded-full bg-red-600" /> Heavy
        </span>
        <span className="ml-auto hidden text-slate-400 sm:inline">Solid = immediate · Dashed = pickup needed</span>
      </div>
    </div>
  );
}
