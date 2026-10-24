import { describe, expect, it } from 'vitest';
import { suggestedReportLocation } from '@/lib/report-location';

describe('Report location suggestions', () => {
  it('does not suggest an inaccurate device location', () => {
    expect(suggestedReportLocation({ lat: 12.97, lng: 77.59, method: 'device', label: 'Current location', accuracy: 2000 })).toBeNull();
  });
  it('does not suggest a device location without accuracy', () => {
    expect(suggestedReportLocation({ lat: 12.97, lng: 77.59, method: 'device', label: 'Current location' })).toBeNull();
  });
  it('offers reliable GPS only as a suggested point', () => {
    expect(suggestedReportLocation({ lat: 12.97, lng: 77.59, method: 'device', label: 'Current location', accuracy: 10 })).toEqual({ lat: 12.97, lng: 77.59 });
  });
  it('preserves a manually chosen point', () => {
    expect(suggestedReportLocation({ lat: 12.97, lng: 77.59, method: 'manual', label: 'Chosen pin' })).toEqual({ lat: 12.97, lng: 77.59 });
  });
});