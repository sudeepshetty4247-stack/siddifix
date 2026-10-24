// Browser-only Leaflet map. Load via LazyMap, never import from SSR routes directly.
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMapEvents, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { Ward } from "@/lib/directory";
import { geometryRings, wardMapBounds } from "@/lib/bengaluru-map";

export type MapMarker = { id: string; lat: number; lng: number; tone?: "open" | "resolved" | "critical" | "overdue"; label?: string; href?: string; sub?: string };
export type MapCount = { id: string; lat: number; lng: number; count: number; label?: string };

const colorVar = { open: "var(--primary)", resolved: "var(--success)", critical: "var(--destructive)", overdue: "var(--warning)" };

function countBadge(count: number) {
  const label = count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
  const size = count >= 100 ? 64 : count >= 10 ? 56 : 48;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:999px;background:var(--destructive);color:var(--destructive-foreground);font-weight:700;font-size:${count >= 100 ? 17 : 15}px;border:3px solid var(--card);box-shadow:0 4px 14px oklch(0.3 0.1 27 / .45)">${label}</span>`,
  });
}

function dot(tone: MapMarker["tone"] = "open") {
  return L.divIcon({
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<span style="display:block;width:22px;height:22px;border-radius:999px;background:${colorVar[tone]};border:3px solid var(--card);box-shadow:0 2px 8px oklch(0.2 0.04 255 / .35)"></span>`,
  });
}
const pin = L.divIcon({
  className: "",
  iconSize: [36, 46],
  iconAnchor: [18, 44],
  html: `<svg width="36" height="46" viewBox="0 0 36 46"><path d="M18 2C9.2 2 2 8.9 2 17.4 2 29 18 44 18 44s16-15 16-26.6C34 8.9 26.8 2 18 2Z" style="fill:var(--ink)"/><circle cx="18" cy="17" r="6" style="fill:var(--primary)"/></svg>`,
});

function Picker({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick?.(e.latlng.lat, e.latlng.lng) });
  return null;
}
function Recenter({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom ?? map.getZoom(), { animate: true });
  }, [lat, lng, zoom, map]);
  return null;
}

function WardLayer({ wards, selectedWard, onWardSelect, focused }: { wards: Ward[]; selectedWard?: string; onWardSelect?: (id: string, point: {lat: number; lng: number}) => void; focused: boolean }) {
  const map = useMap();
  const bounds = wardMapBounds(wards);
  useEffect(() => {
    if (!bounds) return;
    map.setMaxBounds(L.latLngBounds(bounds).pad(0.08));
    map.setMinZoom(Math.max(10, map.getBoundsZoom(L.latLngBounds(bounds), false)));
    if (!focused) map.fitBounds(bounds, { padding: [18, 18], animate: false });
    return () => { map.setMaxBounds([]); map.setMinZoom(0); };
  }, [wards, map, focused]);
  // A local outer ring avoids the antimeridian wrapping of a world-sized mask.
  const outer = [[10, 74], [16, 74], [16, 81], [10, 81], [10, 74]];
  const holes = wards.flatMap(w => geometryRings(w.boundary)).map(r => r.map(p => [p[1] ?? 0, p[0] ?? 0]));
  return <>
    <GeoJSON data={{ type: 'Polygon', coordinates: [outer.map(p => [p[1], p[0]]), ...holes.map(r => r.map(p => [p[1], p[0]]))] } as GeoJSON.GeoJsonObject} style={{ fillColor: 'var(--map-mask)', fillOpacity: 0.7, weight: 0 }} interactive={false} />
    {wards.map(w => <GeoJSON key={`${w.id}-${w.identifier === selectedWard}-${!!onWardSelect}`} data={w.boundary as unknown as GeoJSON.GeoJsonObject}
      style={{ color: w.identifier === selectedWard ? 'var(--ink)' : 'var(--primary)', weight: w.identifier === selectedWard ? 2.5 : 0.7, fillColor: 'var(--primary)', fillOpacity: w.identifier === selectedWard ? 0.25 : 0.055 }}
      onEachFeature={(_, layer) => { layer.bindTooltip(`${w.ward_number ?? ''} · ${w.name}`); layer.on('click', (event: L.LeafletMouseEvent) => { if (onWardSelect) L.DomEvent.stopPropagation(event); onWardSelect?.(w.identifier, {lat: event.latlng.lat, lng: event.latlng.lng}); }); }} />)}
  </>;
}

export default function MapView({
  center,
  zoom = 13,
  markers = [],
  picked,
  onPick,
  recenter,
  className,
  onSelect,
  wards,
  selectedWard,
  onWardSelect,
}: {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  picked?: { lat: number; lng: number } | null;
  onPick?: (lat: number, lng: number) => void;
  recenter?: { lat: number; lng: number; zoom?: number } | null;
  className?: string | undefined;
  onSelect?: (id: string) => void;
  wards?: Ward[];
  selectedWard?: string;
  onWardSelect?: (id: string, point: {lat: number; lng: number}) => void;
}) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={zoom} maxBoundsViscosity={1} scrollWheelZoom {...(className ? { className } : {})} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {wards?.length ? <WardLayer wards={wards} focused={!!recenter} {...(selectedWard ? { selectedWard } : {})} {...(onWardSelect ? { onWardSelect } : {})} /> : null}
      {onPick && <Picker onPick={onPick} />}
      {recenter && <Recenter {...recenter} />}
      {picked && (
        <Marker
          position={[picked.lat, picked.lng]}
          icon={pin}
          draggable={!!onPick}
          eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onPick?.(p.lat, p.lng); } }}
        />
      )}
      {markers.map((m) => (
        <Marker key={m.id} position={[m.lat, m.lng]} icon={dot(m.tone)} eventHandlers={onSelect ? {click: () => onSelect(m.id)} : {}}>
          {m.label && (
            <Popup>
              <div style={{ minWidth: 160 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{m.label}</div>
                {m.sub && <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{m.sub}</div>}
                {m.href && !onSelect && <a href={m.href} style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)" }}>View issue →</a>}
              </div>
            </Popup>
          )}
        </Marker>
      ))}
    </MapContainer>
  );
}
