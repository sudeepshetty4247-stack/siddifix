import type { PhotoMetadata } from './report-photo';

export type ConsistencyStatus =
  | 'consistent'
  | 'mismatch'
  | 'insufficient_evidence'
  | 'outside_service_area'
  | 'needs_review';

export type LocationConsistency = {
  status: ConsistencyStatus;
  distanceM: number | null;
  toleranceM: number | null;
  evidenceSource: 'embedded' | 'device-session' | null;
  userConfirmed: boolean;
};

export function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Largest dimension of a coverage bounding box in meters, or null when unknown.
export function coverageScaleM(bounds: unknown): number | null {
  const b = bounds as { south?: number; north?: number; west?: number; east?: number } | null;
  if (!b || [b.south, b.north, b.west, b.east].some((v) => typeof v !== 'number')) return null;
  const midLat = ((b.south as number) + (b.north as number)) / 2;
  const midLng = ((b.west as number) + (b.east as number)) / 2;
  const height = haversineM(b.south as number, midLng, b.north as number, midLng);
  const width = haversineM(midLat, b.west as number, midLat, b.east as number);
  return Math.max(height, width);
}

// Tolerance grows with GPS accuracy and service-area scale; never below 150 m, area term capped at 1 km.
export function locationToleranceM(accuracy: number | null, areaScaleM: number | null): number {
  const accuracyAllowance =
    accuracy !== null && Number.isFinite(accuracy) && accuracy > 0 ? accuracy * 2 : 0;
  const areaAllowance = areaScaleM !== null ? Math.min(areaScaleM * 0.02, 1000) : 0;
  return Math.max(150, accuracyAllowance, areaAllowance);
}

function valid(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function evaluateLocationConsistency(input: {
  photoGps: PhotoMetadata['gps'];
  reportLat: number;
  reportLng: number;
  supported: boolean;
  areaScaleM?: number | null;
  userConfirmed?: boolean;
}): LocationConsistency {
  const userConfirmed = input.userConfirmed === true;
  const gps = input.photoGps;
  const evidenceSource = gps?.source ?? null;
  if (!input.supported) {
    return { status: 'outside_service_area', distanceM: null, toleranceM: null, evidenceSource, userConfirmed };
  }
  if (!gps || !valid(gps.lat, gps.lng)) {
    return { status: 'insufficient_evidence', distanceM: null, toleranceM: null, evidenceSource: null, userConfirmed };
  }
  const distanceM = haversineM(gps.lat, gps.lng, input.reportLat, input.reportLng);
  const toleranceM = locationToleranceM(gps.accuracy, input.areaScaleM ?? null);
  if (distanceM <= toleranceM) {
    return { status: 'consistent', distanceM, toleranceM, evidenceSource, userConfirmed };
  }
  // Device GPS with very poor accuracy cannot support a mismatch claim on its own.
  if (gps.source === 'device-session' && gps.accuracy !== null && gps.accuracy > 500) {
    return { status: 'needs_review', distanceM, toleranceM, evidenceSource, userConfirmed };
  }
  return { status: 'mismatch', distanceM, toleranceM, evidenceSource, userConfirmed };
}
