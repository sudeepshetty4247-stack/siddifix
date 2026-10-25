import type { Json } from '@/integrations/supabase/types';
export type Coverage = { id: string; name: string; state: string; bounds: Json; notice: string; source_url: string | null; verified_at: string | null; reporting_enabled?: boolean };
export type Authority = { id: string; coverage_id: string | null; name: string; kind: string; website_url: string; reporting_url: string | null; phone: string | null; source_url: string; verified_at: string; notes: string };
export type ServiceRule = { authority_id: string; category: string; subcategory: string | null; notes: string; confidence: string };
export type Ward = { source_published_at?: string | null; source_checked_at?: string | null; source_sha256?: string | null; id: string; name: string; identifier: string; corporation: string; boundary: Json; source_url: string; verified_at: string; representative: string | null; representative_source_url: string | null; ward_number: number | null; name_kn: string | null; official_name: string | null; zone: string | null; assembly_no: number | null; assembly: string | null; mla: string | null; mla_party: string | null; lok_sabha: string | null; mp: string | null; population: number | null; verification_status: string; representative_status: string; flags: string[]; notes: string; active: boolean };
export type DepartmentRoute = { id: string; coverage_id: string; category: string; receiving_office: string; fixing_team: string; officer_role: string; contact_label: string | null; contact_phone: string | null; source_url: string | null; verification_status: string; verified_at: string | null; notes: string; active: boolean };
export type Directory = { coverage: Coverage[]; authorities: Authority[]; rules: ServiceRule[]; wards: Ward[]; routes: DepartmentRoute[] };
export type CivicRouting = { coverage: Coverage | null; candidates: Authority[]; ward: Omit<Ward, 'boundary'> | null; route: DepartmentRoute | null; ownershipVerified: boolean; reviewReason: string | null };

function inRing(lng: number, lat: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (!a || !b || a.length < 2 || b.length < 2) continue;
    const [ax = 0, ay = 0] = a, [bx = 0, by = 0] = b;
    const cross = (lng - ax) * (by - ay) - (lat - ay) * (bx - ax);
    if (Math.abs(cross) < 1e-12 && lng >= Math.min(ax, bx) && lng <= Math.max(ax, bx) && lat >= Math.min(ay, by) && lat <= Math.max(ay, by)) return true;
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
  const matches = directory.wards.filter(w => w.active && coverage?.reporting_enabled !== false && pointInGeometry(lat, lng, w.boundary));
  const wardRow = matches.length === 1 ? matches[0] : undefined;
  let ward: Omit<Ward, 'boundary'> | null = null;
  if (wardRow) { const { boundary: _b, ...rest } = wardRow; ward = rest; }
  const route = ward && coverage ? (directory.routes.find(r => r.active && r.coverage_id === coverage.id && r.category === category) ?? null) : null;
  const ids = new Set(directory.rules.filter(r => r.category === category && (!r.subcategory || r.subcategory === subcategory)).map(r => r.authority_id));
  return { coverage, ward, candidates: coverage ? directory.authorities.filter(a => a.coverage_id === coverage.id && ids.has(a.id)) : [], route, ownershipVerified: false, reviewReason: matches.length > 1 ? 'This pin touches overlapping or shared ward boundaries. Staff must confirm the ward.' : !ward ? 'No supported ward boundary matches this pin. Manual review required.' : !route || route.verification_status !== 'verified' ? 'Department and operational team require verification; no external assignment has been made.' : null };
}