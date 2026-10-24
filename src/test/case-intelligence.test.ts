import { describe, it, expect } from 'vitest';
import { caseMetrics, findDuplicateSuggestions, findRecurringPatterns, scoreDuplicate, type IntelCase } from '@/lib/case-intelligence';

const base = { lat: 12.9716, lng: 77.5946 };
const at = (days: number) => new Date(Date.UTC(2026, 5, 1) + days * 86_400_000).toISOString();
let n = 0;
function c(p: Partial<IntelCase>): IntelCase {
  n++;
  return { id: `id${n}`, ref_code: `BLR-${n}`, title: 'Deep pothole on road', summary: 'pothole near bus stop', category: 'pothole', severity: 'medium', status: 'submitted', lat: base.lat, lng: base.lng, created_at: at(0), resolved_at: null, duplicate_of: null, ...p };
}
const NOW = Date.UTC(2026, 9, 24);
const metres = (m: number) => m / 111_320;

describe('duplicate detection', () => {
  it('suggests same issue, same place, close in time', () => {
    const a = c({ created_at: at(0) }), b = c({ created_at: at(1), lat: base.lat + metres(10) });
    expect(findDuplicateSuggestions([a, b])[0]?.candidate.id).toBe(a.id);
  });
  it('still suggests when descriptions differ', () => {
    const a = c({}), b = c({ created_at: at(0.2), title: 'Crater', summary: 'big hole' });
    expect(scoreDuplicate(b, a)).not.toBeNull();
  });
  it('keeps two potholes 200 m apart separate', () => {
    expect(scoreDuplicate(c({ created_at: at(1), lat: base.lat + metres(200) }), c({}))).toBeNull();
  });
  it('never matches different categories at the same spot', () => {
    expect(scoreDuplicate(c({ category: 'streetlight', created_at: at(1) }), c({}))).toBeNull();
  });
  it('does not match similar text at distant locations', () => {
    expect(scoreDuplicate(c({ created_at: at(1), lng: base.lng + metres(5000) }), c({}))).toBeNull();
  });
  it('treats a report after resolution as recurrence, not duplicate', () => {
    expect(scoreDuplicate(c({ created_at: at(10) }), c({ status: 'resolved', resolved_at: at(5) }))).toBeNull();
  });
  it('skips pairs staff already decided', () => {
    const a = c({}), b = c({ created_at: at(1) });
    expect(findDuplicateSuggestions([a, b], new Set([`${b.id}:${a.id}`]))).toHaveLength(0);
  });
  it('ignores already-linked reports', () => {
    const a = c({}), b = c({ created_at: at(1), duplicate_of: 'x' });
    expect(findDuplicateSuggestions([a, b])).toHaveLength(0);
  });
});

describe('counting', () => {
  it('linked reports are not separate issues', () => {
    const a = c({ status: 'resolved' }), b = c({ duplicate_of: a.id, status: 'resolved' }), d = c({ duplicate_of: a.id });
    expect(caseMetrics([a, b, d])).toMatchObject({ totalReports: 3, uniqueIssues: 1, linkedDuplicateReports: 2, resolvedIssues: 1, activeIssues: 0 });
  });
});

describe('recurring issues', () => {
  it('many duplicate reports of one incident are not a recurrence', () => {
    const a = c({ created_at: at(100) });
    const dups = Array.from({ length: 10 }, () => c({ created_at: at(100), duplicate_of: a.id }));
    expect(findRecurringPatterns([a, ...dups], NOW)).toHaveLength(0);
  });
  it('detects a new incident after an earlier resolution', () => {
    const a = c({ created_at: at(10), status: 'resolved', resolved_at: at(20) }), b = c({ created_at: at(40) });
    const p = findRecurringPatterns([a, b], NOW)[0]!;
    expect(p.recurrences).toBe(1);
    expect(p.openNow).toBe(true);
  });
  it('counts reopened issues', () => {
    const a = c({ created_at: at(10), status: 'resolved', resolved_at: at(20) }), b = c({ created_at: at(40), status: 'reopened' });
    expect(findRecurringPatterns([a, b], NOW)[0]!.reopened).toBe(1);
  });
  it('nearby but unrelated categories are not clustered', () => {
    const a = c({ created_at: at(10), status: 'resolved', resolved_at: at(20) }), b = c({ created_at: at(40), category: 'garbage' });
    expect(findRecurringPatterns([a, b], NOW)).toHaveLength(0);
  });
  it('two concurrent open incidents with no prior repair are not recurrence', () => {
    expect(findRecurringPatterns([c({ created_at: at(10) }), c({ created_at: at(12), lat: base.lat + metres(20) })], NOW)).toHaveLength(0);
  });
  it('report counts include linked duplicates without inflating recurrences', () => {
    const a = c({ created_at: at(10), status: 'resolved', resolved_at: at(20) }), b = c({ created_at: at(40) });
    const d1 = c({ created_at: at(40), duplicate_of: b.id }), d2 = c({ created_at: at(41), duplicate_of: b.id });
    const p = findRecurringPatterns([a, b, d1, d2], NOW)[0]!;
    expect(p.recurrences).toBe(1);
    expect(p.reportCount).toBe(4);
  });
  it('unlinking a report changes the recurrence picture', () => {
    const a = c({ created_at: at(10), status: 'resolved', resolved_at: at(20) }), b = c({ created_at: at(40), duplicate_of: a.id });
    expect(findRecurringPatterns([a, b], NOW)).toHaveLength(0);
    expect(findRecurringPatterns([a, { ...b, duplicate_of: null }], NOW)).toHaveLength(1);
  });
  it('flags uncertainty when an earlier incident has no recorded resolution', () => {
    const a = c({ created_at: at(10), status: 'resolved', resolved_at: at(20) }), b = c({ created_at: at(40) }), d = c({ created_at: at(45) });
    expect(findRecurringPatterns([a, b, d], NOW)[0]!.uncertain).toBe(false);
    const x = c({ created_at: at(5) }), y = c({ created_at: at(10), status: 'resolved', resolved_at: at(20) }), z = c({ created_at: at(40) });
    expect(findRecurringPatterns([x, y, z], NOW)[0]!.uncertain).toBe(true);
  });
  it('priority follows the documented formula', () => {
    const a = c({ created_at: at(10), status: 'resolved', resolved_at: at(20), severity: 'high' }), b = c({ created_at: at(40) });
    // incidents-1 = 1, recurrences 2×1 = 2, severity high = 3, open = 3, fast return (20 days) = 2
    expect(findRecurringPatterns([a, b], NOW)[0]!.priority).toBe(11);
  });
});
