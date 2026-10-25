import { describe, expect, it } from 'vitest';
import {
  coverageScaleM,
  evaluateLocationConsistency,
  haversineM,
  locationToleranceM,
} from '@/lib/location-consistency';

const blr = { lat: 12.9716, lng: 77.5946 };
const device = (lat: number, lng: number, accuracy: number | null) =>
  ({ lat, lng, accuracy, acquiredAt: null, source: 'device-session' as const });
const embedded = (lat: number, lng: number) =>
  ({ lat, lng, accuracy: null, acquiredAt: null, source: 'embedded' as const });

describe('haversineM', () => {
  it('measures known distances', () => {
    expect(haversineM(blr.lat, blr.lng, blr.lat, blr.lng)).toBe(0);
    // ~1 deg latitude ≈ 111 km
    expect(haversineM(12, 77, 13, 77)).toBeGreaterThan(110000);
    expect(haversineM(12, 77, 13, 77)).toBeLessThan(112500);
  });
});

describe('locationToleranceM', () => {
  it('never goes below 150 m', () => {
    expect(locationToleranceM(null, null)).toBe(150);
    expect(locationToleranceM(10, null)).toBe(150);
  });
  it('grows with GPS accuracy', () => {
    expect(locationToleranceM(200, null)).toBe(400);
  });
  it('scales with the service area but caps at 1 km', () => {
    expect(locationToleranceM(null, 20000)).toBe(400);
    expect(locationToleranceM(null, 500000)).toBe(1000);
  });
});

describe('coverageScaleM', () => {
  it('returns the largest bounding-box dimension', () => {
    const scale = coverageScaleM({ south: 12.8, north: 13.15, west: 77.4, east: 77.8 });
    expect(scale).toBeGreaterThan(30000);
    expect(scale).toBeLessThan(50000);
  });
  it('returns null for malformed bounds', () => {
    expect(coverageScaleM(null)).toBeNull();
    expect(coverageScaleM({ south: 12 })).toBeNull();
  });
});

describe('evaluateLocationConsistency', () => {
  it('reports outside_service_area before looking at evidence', () => {
    const r = evaluateLocationConsistency({ photoGps: embedded(blr.lat, blr.lng), reportLat: blr.lat, reportLng: blr.lng, supported: false });
    expect(r.status).toBe('outside_service_area');
  });
  it('reports insufficient_evidence when no photo location exists', () => {
    const r = evaluateLocationConsistency({ photoGps: null, reportLat: blr.lat, reportLng: blr.lng, supported: true });
    expect(r).toMatchObject({ status: 'insufficient_evidence', distanceM: null, evidenceSource: null });
  });
  it('reports insufficient_evidence for malformed coordinates', () => {
    const r = evaluateLocationConsistency({ photoGps: device(NaN, 200, 10), reportLat: blr.lat, reportLng: blr.lng, supported: true });
    expect(r.status).toBe('insufficient_evidence');
  });
  it('reports consistent when evidence is within tolerance', () => {
    const r = evaluateLocationConsistency({ photoGps: device(blr.lat + 0.0005, blr.lng, 30), reportLat: blr.lat, reportLng: blr.lng, supported: true });
    expect(r.status).toBe('consistent');
    expect(r.distanceM).toBeGreaterThan(0);
  });
  it('reports mismatch when embedded photo GPS points to another city', () => {
    const r = evaluateLocationConsistency({ photoGps: embedded(17.68, 75.9), reportLat: blr.lat, reportLng: blr.lng, supported: true });
    expect(r.status).toBe('mismatch');
    expect(r.evidenceSource).toBe('embedded');
    expect(r.distanceM).toBeGreaterThan(100000);
  });
  it('reports mismatch for accurate device GPS far from the pin', () => {
    const r = evaluateLocationConsistency({ photoGps: device(13.2, 77.7, 25), reportLat: blr.lat, reportLng: blr.lng, supported: true });
    expect(r.status).toBe('mismatch');
  });
  it('reports needs_review when device accuracy is too poor to compare', () => {
    const r = evaluateLocationConsistency({ photoGps: device(13.2, 77.7, 2000), reportLat: blr.lat, reportLng: blr.lng, supported: true });
    expect(r.status).toBe('needs_review');
  });
  it('respects large-area tolerance for rural service areas', () => {
    const r = evaluateLocationConsistency({ photoGps: device(blr.lat + 0.005, blr.lng, 100), reportLat: blr.lat, reportLng: blr.lng, supported: true, areaScaleM: 100000 });
    expect(r.status).toBe('consistent');
    expect(r.toleranceM).toBe(1000);
  });
  it('carries the user confirmation flag without changing the status', () => {
    const r = evaluateLocationConsistency({ photoGps: embedded(17.68, 75.9), reportLat: blr.lat, reportLng: blr.lng, supported: true, userConfirmed: true });
    expect(r).toMatchObject({ status: 'mismatch', userConfirmed: true });
  });
});
