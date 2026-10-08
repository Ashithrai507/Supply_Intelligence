import { Fragment, useMemo } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
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
    return <p className="text-sm text-gray-500">No donor routes to show yet.</p>;
  }

  return (
    <div>
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [24, 24] }}
        style={{ height: 240, width: "100%", borderRadius: 8, zIndex: 0 }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CircleMarker
          center={[center.lat, center.lng]}
          radius={9}
          pathOptions={{ color: "#1f2937", fillColor: "#1f2937", fillOpacity: 1 }}
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
                  opacity: 0.85,
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
                pathOptions={{ color, fillColor: color, fillOpacity: 1 }}
              >
                <Popup><strong>{o.donor}</strong> (donor)</Popup>
              </CircleMarker>
            </Fragment>
          );
        })}
      </MapContainer>
      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-600">
        <span><span className="mr-1 inline-block h-2 w-4 rounded bg-green-600 align-middle" />Low traffic</span>
        <span><span className="mr-1 inline-block h-2 w-4 rounded bg-amber-600 align-middle" />Moderate</span>
        <span><span className="mr-1 inline-block h-2 w-4 rounded bg-red-600 align-middle" />Heavy</span>
        <span className="ml-auto">Locations and traffic are filler data</span>
      </div>
    </div>
  );
}
