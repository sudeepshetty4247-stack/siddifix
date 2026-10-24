import type { Directory, Ward } from './directory';
import { pointInGeometry } from './directory';
import type { SelectedLocation } from './location';
import { suggestedReportLocation } from './report-location';

export function citizenMapFocus(directory: Directory | undefined, location: SelectedLocation | null) {
  const point = suggestedReportLocation(location);
  if (!directory || !point) return null;
  return directory.wards.some(ward => ward.active && pointInGeometry(point.lat, point.lng, ward.boundary)) ? point : null;
}

/** GPS within this accuracy is treated as "you are here"; rougher fixes are labelled approximate. */
export const PRECISE_FIX_METRES = 100;

export type LiveFixPlace =
  | { kind: 'ward'; ward: Ward; precise: boolean }
  | { kind: 'boundary'; wards: Ward[]; precise: boolean }
  | { kind: 'outside' };

/** Where a live device fix falls among the published ward boundaries. Never clamps outside points. */
export function describeLiveFix(directory: Directory | undefined, fix: { lat: number; lng: number; accuracy: number } | null): LiveFixPlace | null {
  if (!directory || !fix || !directory.wards.length) return null;
  const precise = Number.isFinite(fix.accuracy) && fix.accuracy <= PRECISE_FIX_METRES;
  const matches = directory.wards.filter(w => w.active && pointInGeometry(fix.lat, fix.lng, w.boundary));
  if (matches.length === 1 && matches[0]) return { kind: 'ward', ward: matches[0], precise };
  if (matches.length > 1) return { kind: 'boundary', wards: matches, precise };
  return { kind: 'outside' };
}

export function corporationShort(corporation: string) {
  return corporation.replace('Bengaluru ', '').replace(' City Corporation', '').replace('Greater ', '');
}
