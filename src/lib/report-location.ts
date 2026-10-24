import type { SelectedLocation } from './location';

// GPS is a suggestion, not evidence of where a photo was captured.
export const MAX_SUGGESTED_ACCURACY_METRES = 100;
export function suggestedReportLocation(location: SelectedLocation | null) {
  if (!location) return null;
  if (location.method === 'device' && (!Number.isFinite(location.accuracy) || (location.accuracy ?? Infinity) > MAX_SUGGESTED_ACCURACY_METRES)) return null;
  return { lat: location.lat, lng: location.lng };
}