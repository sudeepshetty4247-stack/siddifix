import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TEST_LOCATIONS, wardMapBounds, wardPreviewPoint } from '@/lib/bengaluru-map';
import { fileToRows, type WardFile } from '@/lib/wards';
import { pointInGeometry } from '@/lib/directory';

const file = JSON.parse(readFileSync('public/data/bengaluru-wards.json', 'utf8')) as WardFile;
const wards = fileToRows(file);
describe('Bengaluru map and test inputs', () => {
  it('includes every official ward in the browsing bounds', () => {
    const bounds = wardMapBounds(wards);
    expect(bounds).not.toBeNull();
    expect(bounds?.[0][0]).toBeGreaterThan(12);
    expect(bounds?.[1][0]).toBeLessThan(14);
    expect(bounds?.[0][1]).toBeGreaterThan(77);
    expect(bounds?.[1][1]).toBeLessThan(78);
  });
  it.each(TEST_LOCATIONS.filter(t => t.id !== 'outside'))('matches $id test location to its corporation', test => {
    const matches = wards.filter(w => pointInGeometry(test.lat, test.lng, w.boundary));
    expect(matches).toHaveLength(1);
    expect(matches[0]?.corporation).toBe(`Bengaluru ${test.id[0]?.toUpperCase()}${test.id.slice(1)} City Corporation`);
  });
  it('does not claim a Bengaluru ward for Mysuru', () => {
    const outside = TEST_LOCATIONS.find(t => t.id === 'outside');
    expect(wards.some(w => pointInGeometry(outside?.lat ?? 0, outside?.lng ?? 0, w.boundary))).toBe(false);
  });
  it('gives every one of 369 selectable wards a genuine interior preview pin', () => {
    expect(wards).toHaveLength(369);
    const failures = wards.filter(w => {
      const p = wardPreviewPoint(w);
      return !p || !pointInGeometry(p.lat, p.lng, w.boundary);
    });
    expect(failures.map(w => w.identifier)).toEqual([]);
  });
});