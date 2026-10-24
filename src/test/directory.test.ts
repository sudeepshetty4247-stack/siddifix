import { describe, it, expect } from 'vitest';
import { pointInGeometry, resolveCivicRouting, type Directory } from '@/lib/directory';
const directory: Directory = {
  coverage: [{ id: 'bengaluru', name: 'Bengaluru', state: 'partial', bounds: { south: 12.7, north: 13.25, west: 77.35, east: 77.85 }, source_url: 'https://bbmptax.karnataka.gov.in/', verified_at: '2026-10-24', notice: 'Partial directory coverage' }],
  authorities: [{ id: 'bescom', coverage_id: 'bengaluru', name: 'BESCOM', kind: 'electricity', website_url: 'https://bescom.karnataka.gov.in/', reporting_url: null, phone: '1912', source_url: 'https://bescom.karnataka.gov.in/', verified_at: '2026-10-24', notes: '' }],
  rules: [{ authority_id: 'bescom', category: 'electricity', subcategory: null, confidence: 'candidate', notes: '' }], wards: [], routes: [],
};
describe('source-based civic routing', () => {
  it('never claims verified ownership without asset and service boundaries', () => {
    const result = resolveCivicRouting(directory, 12.9716, 77.5946, 'electricity');
    expect(result.candidates.map(a => a.name)).toEqual(['BESCOM']);
    expect(result.ownershipVerified).toBe(false);
  });
  it('leaves Bengaluru wards unverified when no current boundary is imported', () => {
    expect(resolveCivicRouting(directory, 12.9716, 77.5946, 'roads').ward).toBeNull();
  });
  it('allows expansion without guessing Bengaluru authorities for another city', () => {
    const result = resolveCivicRouting(directory, 28.6139, 77.209, 'electricity');
    expect(result.coverage).toBeNull(); expect(result.candidates).toEqual([]);
  });
  it('does not route roads to the electricity authority', () => {
    expect(resolveCivicRouting(directory, 12.9716, 77.5946, 'roads').candidates).toEqual([]);
  });
  it('matches polygons but excludes holes', () => {
    const boundary = { type: 'Polygon', coordinates: [[[77,12],[78,12],[78,13],[77,13],[77,12]],[[77.4,12.4],[77.6,12.4],[77.6,12.6],[77.4,12.6],[77.4,12.4]]] };
    expect(pointInGeometry(12.2,77.2,boundary)).toBe(true);
    expect(pointInGeometry(12.5,77.5,boundary)).toBe(false);
    expect(pointInGeometry(14,77.2,boundary)).toBe(false);
  });
  it('requires manual review for shared ward edges instead of choosing the first ward', () => {
    const square = (west: number, east: number) => ({ type: 'Polygon', coordinates: [[[west,12],[east,12],[east,13],[west,13],[west,12]]] });
    const wards = [{ id: 'a', identifier: 'a', active: true, boundary: square(77,77.5) }, { id: 'b', identifier: 'b', active: true, boundary: square(77.5,78) }] as Directory['wards'];
    const result = resolveCivicRouting({ ...directory, wards }, 12.5, 77.5, 'roads');
    expect(result.ward).toBeNull();
    expect(result.reviewReason).toContain('shared ward boundaries');
  });
});