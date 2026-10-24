import { describe, expect, it } from 'vitest';
import { computeTargets, deadlineState } from '@/lib/service-targets';
import { canAcceptReport, coverageFromWardMatches } from '@/lib/coverage';

const t0 = new Date('2026-10-24T10:00:00.000Z');
describe('service targets', () => {
  it('uses the active configured rule for category and severity', () => {
    const r = computeTargets([{ category: 'roads', severity: 'high', ack_hours: 6, resolve_hours: 48, version: 3, active: true }], 'roads', 'high', t0);
    expect(r.ackDueAt).toBe('2026-10-24T16:00:00.000Z');
    expect(r.resolveDueAt).toBe('2026-10-26T10:00:00.000Z');
    expect(r.snapshot.version).toBe(3);
    expect(r.snapshot.source).toBe('configured');
  });
  it('falls back to severity defaults when the rule is inactive', () => {
    const r = computeTargets([{ category: 'roads', severity: 'critical', ack_hours: 1, resolve_hours: 2, version: 1, active: false }], 'roads', 'critical', t0);
    expect(r.ackDueAt).toBe('2026-10-24T14:00:00.000Z');
    expect(r.resolveDueAt).toBe('2026-10-25T10:00:00.000Z');
    expect(r.snapshot.source).toBe('default');
  });
  it('flags overdue only for open cases', () => {
    const now = new Date('2026-10-24T13:00:00Z').getTime();
    expect(deadlineState('2026-10-24T10:00:00Z', true, 'resolution', now)?.overdue).toBe(true);
    expect(deadlineState('2026-10-24T10:00:00Z', false, 'resolution', now)?.overdue).toBe(false);
    expect(deadlineState('2026-10-24T20:00:00Z', true, 'resolution', now)?.overdue).toBe(false);
  });
});

describe('coverage', () => {
  it('rejects points outside every ward and accepts shared boundaries for review', () => {
    expect(canAcceptReport(coverageFromWardMatches(0))).toBe(false);
    expect(coverageFromWardMatches(2)).toBe('boundary_review');
    expect(canAcceptReport(coverageFromWardMatches(1))).toBe(true);
  });
});
