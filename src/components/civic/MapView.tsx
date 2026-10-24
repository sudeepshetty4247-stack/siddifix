// Browser-only Leaflet map. Load via LazyMap, never import from SSR routes directly.
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, Circle, ZoomControl, useMapEvents, useMap } from "react-leaflet";
import { useEffect, useState } from "react";
import type { Ward } from "@/lib/directory";
import { geometryRings, wardMapBounds } from "@/lib/bengaluru-map";

export type MapMarker = { id: string; lat: number; lng: number; tone?: "open" | "resolved" | "critical" | "overdue"; label?: string; href?: string; sub?: string };
export type MapCount = { id: string; lat: number; lng: number; count: number; label?: string };

const colorVar = { open: "var(--primary)", resolved: "var(--success)", critical: "var(--destructive)", overdue: "var(--warning)" };

function countBadge(count: number) {
  const label = count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
  const size = count >= 100 ? 62 : count >= 10 ? 52 : 44;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span class="civic-count" style="width:${size}px;height:${size}px;font-size:${count >= 100 ? 17 : 15}px">${label}</span>`,
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
const youIcon = L.divIcon({ className: "", iconSize: [22, 22], iconAnchor: [11, 11], html: `<span class="civic-you"></span>` });

function Picker({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick?.(e.latlng.lat, e.latlng.lng) });
  return null;
}
function Recenter({ lat, lng, zoom, nonce }: { lat: number; lng: number; zoom?: number; nonce?: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], zoom ?? map.getZoom(), { duration: 0.8 });
  }, [lat, lng, zoom, nonce, map]);
  return null;
}
function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  useEffect(() => { onZoom(map.getZoom()); }, [map, onZoom]);
  return null;
}

function WardLayer({ wards, selectedWard, highlightWard, onWardSelect, focused }: { wards: Ward[]; selectedWard?: string; highlightWard?: string; onWardSelect?: (id: string, point: {lat: number; lng: number}) => void; focused: boolean }) {
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
    {wards.map(w => {
      const hl = w.identifier === highlightWard, sel = w.identifier === selectedWard;
      return <GeoJSON key={`${w.id}-${sel}-${hl}-${!!onWardSelect}`} data={w.boundary as unknown as GeoJSON.GeoJsonObject}
        style={hl
          ? { color: 'var(--destructive)', weight: 2.5, fillColor: 'var(--destructive)', fillOpacity: 0.22 }
          : { color: sel ? 'var(--ink)' : 'var(--destructive)', weight: sel ? 2.5 : 0.6, opacity: sel ? 1 : 0.45, fillColor: sel ? 'var(--primary)' : 'var(--destructive)', fillOpacity: sel ? 0.22 : 0.04 }}
        onEachFeature={(_, layer) => { layer.bindTooltip(`${w.ward_number ?? ''} · ${w.name}`); layer.on('click', (event: L.LeafletMouseEvent) => { if (onWardSelect) L.DomEvent.stopPropagation(event); onWardSelect?.(w.identifier, {lat: event.latlng.lat, lng: event.latlng.lng}); }); }} />;
    })}
  </>;
}

export default function MapView({
  center,
  zoom = 13,
  markers = [],
  counts = [],
  picked,
  onPick,
  recenter,
  className,
  onSelect,
  onCountSelect,
  wards,
  selectedWard,
  highlightWard,
  onWardSelect,
  you,
  clusterBelowZoom,
}: {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  counts?: MapCount[];
  picked?: { lat: number; lng: number } | null;
  onPick?: (lat: number, lng: number) => void;
  recenter?: { lat: number; lng: number; zoom?: number; nonce?: number } | null;
  className?: string | undefined;
  onSelect?: (id: string) => void;
  onCountSelect?: (id: string) => void;
  wards?: Ward[];
  selectedWard?: string;
  highlightWard?: string;
  onWardSelect?: (id: string, point: {lat: number; lng: number}) => void;
  /** Live device position: blue dot with its accuracy circle. */
  you?: { lat: number; lng: number; accuracy: number } | null;
  /** When set, ward count bubbles show below this zoom and individual cases at or above it. */
  clusterBelowZoom?: number;
}) {
  const [z, setZ] = useState(zoom);
  const showCounts = clusterBelowZoom === undefined || z < clusterBelowZoom;
  const showMarkers = clusterBelowZoom === undefined || z >= clusterBelowZoom;
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={zoom} zoomControl={false} maxBoundsViscosity={1} scrollWheelZoom {...(className ? { className } : {})} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        className="civic-tiles"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="bottomright" />
      {clusterBelowZoom !== undefined && <ZoomWatcher onZoom={setZ} />}
      {wards?.length ? <WardLayer wards={wards} focused={!!recenter} {...(selectedWard ? { selectedWard } : {})} {...(highlightWard ? { highlightWard } : {})} {...(onWardSelect ? { onWardSelect } : {})} /> : null}
      {onPick && <Picker onPick={onPick} />}
      {recenter && <Recenter {...recenter} />}
      {you && <>
        <Circle center={[you.lat, you.lng]} radius={Math.min(you.accuracy, 3000)} pathOptions={{ color: 'var(--info, var(--primary))', weight: 1, fillColor: 'var(--info, var(--primary))', fillOpacity: 0.12 }} interactive={false} />
        <Marker position={[you.lat, you.lng]} icon={youIcon} interactive={false} zIndexOffset={1000} />
      </>}
      {picked && (
        <Marker
          position={[picked.lat, picked.lng]}
          icon={pin}
          draggable={!!onPick}
          eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onPick?.(p.lat, p.lng); } }}
        />
      )}
      {showCounts && counts.map((c) => (
        <Marker key={`count-${c.id}`} position={[c.lat, c.lng]} icon={countBadge(c.count)} eventHandlers={onCountSelect ? { click: () => onCountSelect(c.id) } : {}}>
          {c.label && !onCountSelect && <Popup><div style={{ fontWeight: 600 }}>{c.label}</div><div style={{ fontSize: 12, opacity: 0.7 }}>{c.count} report{c.count === 1 ? "" : "s"}</div></Popup>}
        </Marker>
      ))}
      {showMarkers && markers.map((m) => (
        <Marker key={m.id} position={[m.lat, m.lng]} icon={dot(m.tone)} eventHandlers={onSelect ? {click: () => onSelect(m.id)} : {}}>
          {m.label && !onSelect && (
            <Popup>
              <div style={{ minWidth: 160 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{m.label}</div>
                {m.sub && <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{m.sub}</div>}
                {m.href && <a href={m.href} style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)" }}>View issue →</a>}
              </div>
            </Popup>
          )}
        </Marker>
      ))}
    </MapContainer>
  );
}
