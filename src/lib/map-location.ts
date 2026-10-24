import type { Directory } from './directory';
import { pointInGeometry } from './directory';
import type { SelectedLocation } from './location';
import { suggestedReportLocation } from './report-location';

export function citizenMapFocus(directory: Directory | undefined, location: SelectedLocation | null) {
  const point = suggestedReportLocation(location);
  if (!directory || !point) return null;
  return directory.wards.some(ward => ward.active && pointInGeometry(point.lat, point.lng, ward.boundary)) ? point : null;
}