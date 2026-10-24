import { pointInGeometry, type Ward } from './directory';

export const TEST_LOCATIONS = [
  { id: 'central', label: 'Central · Vidhana Soudha', lat: 12.9796, lng: 77.5907, category: 'waste' },
  { id: 'south', label: 'South · Koramangala', lat: 12.9352, lng: 77.6245, category: 'roads' },
  { id: 'north', label: 'North · Yelahanka', lat: 13.1007, lng: 77.5963, category: 'streetlights' },
  { id: 'east', label: 'East · Whitefield', lat: 12.9698, lng: 77.75, category: 'drainage' },
  { id: 'west', label: 'West · Kengeri', lat: 12.9081, lng: 77.4851, category: 'water' },
  { id: 'outside', label: 'Outside coverage · Mysuru', lat: 12.2958, lng: 76.6394, category: 'waste' },
] as const;

export function geometryRings(geometry: unknown): number[][][] {
  const g = geometry as { type?: string; coordinates?: number[][][] | number[][][][] } | null;
  if (g?.type === 'Polygon') return g.coordinates?.[0] ? [g.coordinates[0] as number[][]] : [];
  if (g?.type === 'MultiPolygon') return (g.coordinates as number[][][][]).flatMap(p => p[0] ? [p[0]] : []);
  return [];
}

export function wardMapBounds(wards: Pick<Ward, 'boundary'>[]): [[number, number], [number, number]] | null {
  const points = wards.flatMap(w => geometryRings(w.boundary).flat());
  if (!points.length) return null;
  return [[Math.min(...points.map(p => p[1] ?? 90)), Math.min(...points.map(p => p[0] ?? 180))],
    [Math.max(...points.map(p => p[1] ?? -90)), Math.max(...points.map(p => p[0] ?? -180))]];
}

export function wardPreviewPoint(ward: Pick<Ward, 'boundary'>): { lat: number; lng: number } | null {
  // Scan the largest polygon for an interior point; never use a boundary vertex as a ward match.
  const ring = geometryRings(ward.boundary).sort((a, b) => b.length - a.length)[0];
  if (!ring?.length) return null;
  const xs = ring.map(p => p[0] ?? 0), ys = ring.map(p => p[1] ?? 0);
  const west = Math.min(...xs), east = Math.max(...xs), south = Math.min(...ys), north = Math.max(...ys);
  for (const fraction of [0.5, 0.25, 0.75, 0.1, 0.9, 0.4, 0.6]) {
    for (let j = 1; j < 20; j++) {
      const lng = west + (east - west) * fraction, lat = south + (north - south) * j / 20;
      if (pointInGeometry(lat, lng, ward.boundary)) return { lat, lng };
    }
  }
  return null;
}