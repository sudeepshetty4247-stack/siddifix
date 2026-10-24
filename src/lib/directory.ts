import type { Json } from '@/integrations/supabase/types';
export type Coverage = { id: string; name: string; state: string; bounds: Json; notice: string; source_url: string | null; verified_at: string | null };
export type Authority = { id: string; coverage_id: string | null; name: string; kind: string; website_url: string; reporting_url: string | null; phone: string | null; source_url: string; verified_at: string; notes: string };
export type ServiceRule = { authority_id: string; category: string; subcategory: string | null; notes: string; confidence: string };
export type Ward = { name: string; identifier: string; corporation: string; boundary: Json; source_url: string; verified_at: string; representative: string | null; representative_source_url: string | null };
export type Directory = { coverage: Coverage[]; authorities: Authority[]; rules: ServiceRule[]; wards: Ward[] };
export type CivicRouting = { coverage: Coverage | null; candidates: Authority[]; ward: Omit<Ward, 'boundary'> | null; ownershipVerified: boolean };

function inRing(lng: number, lat: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (!a || !b || a.length < 2 || b.length < 2) continue;
    const [ax = 0, ay = 0] = a, [bx = 0, by = 0] = b;
    if ((ay > lat) !== (by > lat) && lng < ((bx - ax) * (lat - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}
export function pointInGeometry(lat: number, lng: number, geometry: unknown): boolean {
  if (!geometry || typeof geometry !== 'object') return false;
  const g = geometry as { type?: string; coordinates?: number[][][] | number[][][][] };
  const polygon = (rings: number[][][]) => !!rings[0] && inRing(lng, lat, rings[0]) && !rings.slice(1).some(r => inRing(lng, lat, r));
  if (g.type === 'Polygon' && Array.isArray(g.coordinates)) return polygon(g.coordinates as number[][][]);
  if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates)) return (g.coordinates as number[][][][]).some(polygon);
  return false;
}
export function resolveCivicRouting(directory: Directory, lat: number, lng: number, category?: string, subcategory?: string): CivicRouting {
  // Coverage rectangles describe directory availability only, never legal jurisdiction.
  const coverage = directory.coverage.find(c => {
    const b = c.bounds as { south?: number; north?: number; west?: number; east?: number };
    return typeof b.south === 'number' && typeof b.north === 'number' && typeof b.west === 'number' && typeof b.east === 'number' && lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
  }) ?? null;
  const wardRow = directory.wards.find(w => pointInGeometry(lat, lng, w.boundary));
  const ward = wardRow ? { ...wardRow, boundary: undefined } : null;
  const ids = new Set(directory.rules.filter(r => r.category === category && (!r.subcategory || r.subcategory === subcategory)).map(r => r.authority_id));
  return { coverage, ward, candidates: coverage ? directory.authorities.filter(a => a.coverage_id === coverage.id && ids.has(a.id)) : [], ownershipVerified: false };
}