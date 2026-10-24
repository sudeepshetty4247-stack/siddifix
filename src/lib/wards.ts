import { pointInGeometry } from './directory';

export type WardInfo = {
  id: string; no: number; name: string; name_kn: string | null; corporation: string; zone: string | null;
  ac_no: number; ac: string; mla: string; mla_party: string; ls: string; mp: string; population: number;
};
type WardFeature = { geometry: unknown; properties: WardInfo };
export type WardData = { source: string; notified: string; representatives_source: string; features: WardFeature[] };

export const WARD_SOURCE_LABEL = 'GBA ward delimitation, notified 19 Nov 2025 (OpenCity)';

let cache: Promise<WardData> | null = null;
export function loadWards(): Promise<WardData> {
  cache ??= fetch('/data/bengaluru-wards.json').then(r => { if (!r.ok) throw new Error('Ward map unavailable'); return r.json() as Promise<WardData>; }).catch(e => { cache = null; throw e; });
  return cache;
}

export function findWard(data: Pick<WardData, 'features'>, lat: number, lng: number): WardInfo | null {
  return data.features.find(f => pointInGeometry(lat, lng, f.geometry))?.properties ?? null;
}

/** Role-level responsible office per issue category. Names of individual officers are never invented. */
export const DEPARTMENT_BY_CATEGORY: Record<string, { office: string; role: string; helpline?: string }> = {
  roads: { office: 'City Corporation — Roads & Infrastructure', role: 'Ward Assistant Engineer (AE) / AEE', helpline: '1533' },
  potholes: { office: 'City Corporation — Roads & Infrastructure', role: 'Ward Assistant Engineer (AE) / AEE', helpline: '1533' },
  footpath: { office: 'City Corporation — Roads & Infrastructure', role: 'Ward Assistant Engineer (AE)', helpline: '1533' },
  waste: { office: 'Bengaluru Solid Waste Management Ltd (BSWML)', role: 'Ward Health Inspector / Junior Health Inspector', helpline: '1533' },
  sanitation: { office: 'City Corporation — Health', role: 'Ward Health Inspector', helpline: '1533' },
  streetlights: { office: 'City Corporation — Electrical', role: 'Electrical Assistant Engineer (zone)', helpline: '1533' },
  electricity: { office: 'BESCOM — local sub-division', role: 'Section Officer / AEE (Electrical)', helpline: '1912' },
  water: { office: 'BWSSB — local service station', role: 'Assistant Executive Engineer (service station)', helpline: '1916' },
  drainage: { office: 'City Corporation — Storm Water Drains / BWSSB (sewage)', role: 'SWD Assistant Engineer / BWSSB AEE', helpline: '1533' },
  trees: { office: 'City Corporation — Forest Cell', role: 'Range Forest Officer (zone)', helpline: '1533' },
  parks: { office: 'City Corporation — Horticulture', role: 'Assistant Director, Horticulture (zone)', helpline: '1533' },
  traffic: { office: 'Bengaluru Traffic Police — jurisdictional station', role: 'Station Inspector', helpline: '112' },
  transport: { office: 'BMTC — depot / Traffic Police', role: 'Depot Manager', helpline: '080-22952522' },
  buildings: { office: 'City Corporation — Town Planning', role: 'Assistant Director, Town Planning (zone)', helpline: '1533' },
};
export function departmentFor(category?: string) {
  return (category && DEPARTMENT_BY_CATEGORY[category]) || { office: 'City Corporation — ward office', role: 'Ward Officer', helpline: '1533' };
}
