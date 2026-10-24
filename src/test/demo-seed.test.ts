// @vitest-environment node
// Unit tests for the deterministic demo dataset generator.
import { describe, it, expect } from 'vitest';
import { buildDemoDataset, bucketForIndex, wardCentroid, STATUS_MIX } from '@/lib/demo-seed';

const wards = [
  { identifier: 'W1', name: 'Kudlu', corporation: 'Bommanahalli', coverage_id: 'blr', lng: 77.71, lat: 12.89 },
  { identifier: 'W2', name: 'HSR Layout', corporation: 'Bommanahalli', coverage_id: 'blr', lng: 77.64, lat: 12.91 },
];
const teams = [{ id: 'team-1', department: 'City corporation — ward office', categories: ['roads', 'waste'] }];
const staff = [
  { id: 'staff-1', team_id: 'team-1', department: teams[0]!.department, categories: teams[0]!.categories, name: 'Demo Officer 1' },
  { id: 'staff-2', team_id: 'team-1', department: teams[0]!.department, categories: teams[0]!.categories, name: 'Demo Officer 2' },
];
const targets = [{ category: 'roads', severity: 'medium', ack_hours: 48, resolve_hours: 168 }];
const categories = [{ id: 'roads', subs: ['Pothole'] }, { id: 'waste', subs: ['Overflowing bin'] }];
const NOW = new Date('2026-10-24T12:00:00Z').getTime();
const build = (count = 1500, id = 'demo-v1') => buildDemoDataset({ datasetId: id, count, now: NOW, wards, teams, staff, targets, categories });

describe('demo dataset generator', () => {
  it('creates exactly the requested number of reports, all labelled with the dataset id', () => {
    const d = build(1500);
    expect(d.issues).toHaveLength(1500);
    expect(d.issues.every(i => i.demo_dataset_id === 'demo-v1')).toBe(true);
    expect(new Set(d.issues.map(i => i.ref_code)).size).toBe(1500);
  });
  it('is deterministic for the same dataset id', () => {
    const a = build(200), b = build(200);
    expect(a.issues.map(i => [i.ref_code, i.status, i.created_at, i.lat, i.lng])).toEqual(b.issues.map(i => [i.ref_code, i.status, i.created_at, i.lat, i.lng]));
  });
  it('covers every lifecycle bucket with the planned distribution', () => {
    const counts = STATUS_MIX.map(b => bucketForIndexRange(b.key));
    function bucketForIndexRange(key: string) {
      let n = 0;
      for (let i = 0; i < 1500; i++) if (bucketForIndex(i, 1500) === key) n++;
      return n;
    }
    const d = build(1500);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(1500);
    expect(d.issues.filter(i => i.status === 'closed').length).toBeGreaterThan(200);
    expect(d.issues.filter(i => i.status === 'reopened').length).toBeGreaterThan(80);
    expect(d.issues.filter(i => i.assignment_state === 'exception').length).toBeGreaterThan(80);
  });
  it('keeps timelines logically ordered', () => {
    const d = build(500);
    for (const i of d.issues) {
      const created = new Date(i.created_at).getTime();
      if (i.acknowledged_at) expect(new Date(i.acknowledged_at).getTime()).toBeGreaterThanOrEqual(created);
      if (i.resolved_at) expect(new Date(i.resolved_at).getTime()).toBeGreaterThan(created);
      expect(new Date(i.sla_due_at!).getTime()).toBeGreaterThan(created);
      expect(new Date(i.ack_due_at!).getTime()).toBeGreaterThan(created);
    }
  });
  it('marks overdue cases as open with a past deadline', () => {
    const d = build(1500);
    const overdue = d.issues.filter(i => new Date(i.sla_due_at!).getTime() < NOW && !['resolved', 'closed', 'rejected'].includes(i.status));
    expect(overdue.length).toBeGreaterThan(100);
  });
  it('links duplicates only to earlier canonical reports of the same category', () => {
    const d = build(1500);
    const byId = new Map(d.issues.map(i => [i.id, i]));
    const linked = d.issues.filter(i => i.duplicate_of);
    expect(linked.length).toBeGreaterThan(10);
    for (const l of linked) {
      const parent = byId.get(l.duplicate_of!)!;
      expect(parent).toBeDefined();
      expect(parent.category).toBe(l.category);
      expect(parent.duplicate_of).toBeNull();
      expect(parent.created_at <= l.created_at).toBe(true);
    }
  });
  it('creates confirmation events and feedback only for closed cases', () => {
    const d = build(500);
    const closedIdx = new Set(d.issues.map((i, idx) => i.status === 'closed' ? idx : -1).filter(x => x >= 0));
    expect(d.feedback.length).toBe(closedIdx.size);
    for (const f of d.feedback) expect(closedIdx.has(f.issue_index)).toBe(true);
    for (const e of d.events.filter(e => e.kind === 'citizen_confirmed')) expect(closedIdx.has(e.issue_index)).toBe(true);
  });
  it('gives every report a tracking secret and every event a valid issue', () => {
    const d = build(300);
    expect(d.secrets).toHaveLength(300);
    for (const e of d.events) expect(e.issue_index).toBeGreaterThanOrEqual(0);
  });
});

describe('wardCentroid', () => {
  it('averages the first polygon ring', () => {
    const c = wardCentroid({ coordinates: [[[[77.5, 12.9], [77.7, 12.9], [77.6, 13.0], [77.5, 12.9]]]] });
    expect(c!.lng).toBeCloseTo(77.575);
    expect(c!.lat).toBeCloseTo(12.925);
  });
  it('returns null for unusable boundaries', () => {
    expect(wardCentroid(null)).toBeNull();
    expect(wardCentroid({ coordinates: [] })).toBeNull();
  });
});
