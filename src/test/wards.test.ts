import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pointInGeometry, resolveCivicRouting, type Directory, type Ward } from '@/lib/directory';
import { fileToRows, rankWards, validateWardSet, type WardFile } from '@/lib/wards';

const file = JSON.parse(readFileSync('public/data/bengaluru-wards.json', 'utf8')) as WardFile;
const rows = fileToRows(file);
const wards = rows.map((r, n) => ({ ...r, id: String(n), representative: null, notes: '', active: true })) as unknown as Ward[];
const dir: Directory = {
  coverage: [{ id: 'bengaluru', name: 'Bengaluru', state: 'partial', bounds: { south: 12.7, north: 13.25, west: 77.35, east: 77.85 }, notice: '', source_url: null, verified_at: null }],
  authorities: [], rules: [], wards,
  routes: [{ id: 'r', coverage_id: 'bengaluru', category: 'waste', receiving_office: 'GBA', fixing_team: 'BSWML', officer_role: 'Health Inspector', contact_label: null, contact_phone: null, source_url: null, verification_status: 'verification_required', verified_at: null, notes: '', active: true }],
};
const at = (lat: number, lng: number) => resolveCivicRouting(dir, lat, lng, 'waste').ward;

describe('official ward file', () => {
  it('has 369 wards with no structural problems', () => expect(validateWardSet(rows)).toEqual([]));
  it('flags 33 name differences and 19 cleaned boundaries for review', () => {
    expect(rows.filter(r => r.flags.includes('name_differs_from_division_list')).length).toBe(33);
    expect(rows.filter(r => r.flags.includes('boundary_had_stray_lines_removed')).length).toBe(19);
  });
  it('imports every representative as verification required', () => expect(rows.every(r => r.representative_status === 'verification_required')).toBe(true));
});

describe('ward lookup', () => {
  it.each([
    [12.9796, 77.5907, 'Central'], [12.9352, 77.6245, 'South'], [13.1007, 77.5963, 'North'], [12.9698, 77.7500, 'East'], [12.9081, 77.4851, 'West'],
  ])('finds %f,%f in the %s corporation', (lat, lng, corp) => expect(at(lat, lng)?.corporation).toBe(`Bengaluru ${corp} City Corporation`));
  it('returns no ward outside Bengaluru', () => expect(at(12.2958, 76.6394)).toBeNull());
  it('assigns a point next to a shared boundary to exactly one ward', () => {
    const w = wards.find(x => x.identifier === 'central-4')!;
    const ring = (w.boundary as { coordinates: number[][][][] }).coordinates[0]![0]!;
    const [lng, lat] = ring[0]!;
    const near = [lat! + 0.0002, lng! + 0.0002] as const;
    expect(wards.filter(x => pointInGeometry(near[0], near[1], x.boundary)).length).toBeLessThanOrEqual(1);
  });
  it('skips deactivated wards', () => {
    const off = { ...dir, wards: wards.map(w => ({ ...w, active: w.identifier !== 'central-4' })) };
    expect(resolveCivicRouting(off, 12.9796, 77.5907).ward).toBeNull();
  });
  it('uses the department route with separate receiving and fixing teams', () => {
    const r = resolveCivicRouting(dir, 12.9796, 77.5907, 'waste').route;
    expect(r?.receiving_office).toBe('GBA'); expect(r?.fixing_team).toBe('BSWML');
  });
});

describe('ward leaderboard', () => {
  const names = new Map([['a', 'A'], ['b', 'B']]);
  it('ranks by unresolved unique issues and ignores unknown wards', () => {
    const r = rankWards([{ ward_identifier: 'a', reports: 5, unique_issues: 2, unresolved: 1, resolved: 1 }, { ward_identifier: 'b', reports: 3, unique_issues: 3, unresolved: 3, resolved: 0 }, { ward_identifier: 'x', reports: 9, unique_issues: 9, unresolved: 9, resolved: 0 }], names);
    expect(r.map(x => x.ward_identifier)).toEqual(['b', 'a']);
  });
  it('returns nothing when no ward has reports', () => expect(rankWards([], names)).toEqual([]));
});
