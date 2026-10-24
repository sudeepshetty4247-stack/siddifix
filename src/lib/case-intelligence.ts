import { descriptionOverlap } from './duplicate-evidence';

/**
 * Deterministic duplicate and recurring-issue intelligence.
 * Every score here is a documented rule-based signal, never a model probability.
 */
export type IntelCase = {
  id: string;
  ref_code: string;
  title: string;
  summary: string | null;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  lat: number;
  lng: number;
  created_at: string;
  resolved_at: string | null;
  duplicate_of: string | null;
  ward?: string | null;
};

export const DUPLICATE_RULES = {
  /** Same-category reports within this distance can be the same physical problem. */
  maxDistanceM: 60,
  /** Reports further apart in time than this are not suggested as duplicates. */
  maxGapDays: 21,
  /** Minimum combined signal score to raise a suggestion for staff review. */
  minScore: 0.55,
} as const;

export const RECURRENCE_RULES = {
  /** Distinct incidents at the same spot are clustered within this radius. */
  radiusM: 50,
  /** Look-back window for recurrence. */
  windowDays: 365,
  /** A new incident must start at least this long after the previous resolution. */
  minDaysAfterResolution: 3,
  /** Minimum distinct incidents (not reports) to call a location recurring. */
  minIncidents: 2,
} as const;

const CLOSED = new Set(['resolved', 'closed', 'rejected']);
const SEVERITY_WEIGHT = { low: 1, medium: 2, high: 3, critical: 4 } as const;
const DAY = 86_400_000;

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type DuplicateSignals = { distanceM: number; gapDays: number; textOverlap: number; sameCategory: boolean };
export type DuplicateSuggestion = { report: IntelCase; candidate: IntelCase; score: number; signals: DuplicateSignals; reasons: string[] };

/**
 * Score = 0.5 × proximity + 0.3 × time closeness + 0.2 × description overlap.
 * Category mismatch, resolved originals, or distance/time beyond the limits give no suggestion,
 * so proximity alone can never produce a match.
 */
export function scoreDuplicate(report: IntelCase, candidate: IntelCase): DuplicateSuggestion | null {
  if (report.id === candidate.id || report.category !== candidate.category) return null;
  const d = distanceM(report, candidate);
  const gapDays = Math.abs(new Date(report.created_at).getTime() - new Date(candidate.created_at).getTime()) / DAY;
  if (d > DUPLICATE_RULES.maxDistanceM || gapDays > DUPLICATE_RULES.maxGapDays) return null;
  // A report filed after the candidate was resolved is a possible recurrence, not a duplicate.
  if (candidate.resolved_at && new Date(report.created_at) > new Date(candidate.resolved_at)) return null;
  const text = descriptionOverlap(`${report.title} ${report.summary ?? ''}`, `${candidate.title} ${candidate.summary ?? ''}`);
  const proximity = 1 - d / DUPLICATE_RULES.maxDistanceM;
  const timeliness = 1 - gapDays / DUPLICATE_RULES.maxGapDays;
  const score = Math.round((0.5 * proximity + 0.3 * timeliness + 0.2 * text) * 100) / 100;
  if (score < DUPLICATE_RULES.minScore) return null;
  const reasons = [`Same category`, `${Math.round(d)} m apart`, `${gapDays < 1 ? 'same day' : `${Math.round(gapDays)} days apart`}`, `${Math.round(text * 100)}% description word overlap`];
  return { report, candidate, score, signals: { distanceM: d, gapDays, textOverlap: text, sameCategory: true }, reasons };
}

/**
 * Suggest unlinked newer reports that may duplicate an older canonical issue.
 * Already-linked reports, and pairs a reviewer has already decided, are skipped.
 */
export function findDuplicateSuggestions(cases: IntelCase[], decided: Set<string> = new Set()) {
  const canonical = cases.filter(c => !c.duplicate_of && c.status !== 'rejected');
  const out: DuplicateSuggestion[] = [];
  for (const report of canonical) {
    let best: DuplicateSuggestion | null = null;
    for (const cand of canonical) {
      if (new Date(cand.created_at) >= new Date(report.created_at)) continue; // newer links to older
      if (decided.has(`${report.id}:${cand.id}`)) continue;
      const s = scoreDuplicate(report, cand);
      if (s && (!best || s.score > best.score)) best = s;
    }
    if (best) out.push(best);
  }
  return out.sort((a, b) => b.score - a.score);
}

export type RecurringPattern = {
  key: string;
  category: string;
  ward: string | null;
  center: { lat: number; lng: number };
  incidents: IntelCase[];
  reportCount: number;
  recurrences: number;
  reopened: number;
  firstAt: string;
  lastAt: string;
  lastResolvedAt: string | null;
  openNow: boolean;
  priority: number;
  priorityParts: { incidents: number; recurrences: number; severity: number; open: number; recency: number };
  uncertain: boolean;
  reason: string;
  suggestion: string;
};

/**
 * Cluster distinct incidents (canonical cases only — linked duplicate reports never count as incidents)
 * by category within RECURRENCE_RULES.radiusM. A recurrence is an incident that starts after an earlier
 * incident in the same cluster was resolved.
 *
 * Priority = 2 × recurrences + 1 × (incidents − 1) + max severity weight (1–4) + 3 if open now
 *            + 2 if the latest resolution was within 30 days of the next incident.
 */
export function findRecurringPatterns(cases: IntelCase[], now = Date.now()): RecurringPattern[] {
  const since = now - RECURRENCE_RULES.windowDays * DAY;
  const reportsPerCanonical = new Map<string, number>();
  for (const c of cases) if (c.duplicate_of) reportsPerCanonical.set(c.duplicate_of, (reportsPerCanonical.get(c.duplicate_of) ?? 0) + 1);
  const incidents = cases
    .filter(c => !c.duplicate_of && c.status !== 'rejected' && new Date(c.created_at).getTime() >= since)
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  const clusters: IntelCase[][] = [];
  for (const inc of incidents) {
    const home = clusters.find(cl => cl[0].category === inc.category && distanceM(cl[0], inc) <= RECURRENCE_RULES.radiusM);
    if (home) home.push(inc); else clusters.push([inc]);
  }
  const patterns: RecurringPattern[] = [];
  for (const cl of clusters) {
    if (cl.length < RECURRENCE_RULES.minIncidents) continue;
    let recurrences = 0, fastReturn = false, uncertain = false;
    for (let i = 1; i < cl.length; i++) {
      const prevResolved = cl.slice(0, i).map(p => p.resolved_at).filter(Boolean).map(r => +new Date(r!)).sort((a, b) => b - a)[0];
      const startedAt = +new Date(cl[i].created_at);
      if (prevResolved && startedAt - prevResolved >= RECURRENCE_RULES.minDaysAfterResolution * DAY) {
        recurrences++;
        if (startedAt - prevResolved <= 30 * DAY) fastReturn = true;
      } else if (!prevResolved) uncertain = true;
    }
    const reopened = cl.filter(c => c.status === 'reopened').length;
    if (recurrences === 0 && reopened === 0) continue; // only concurrent separate incidents: not recurrence
    const openNow = cl.some(c => !CLOSED.has(c.status));
    const sev = Math.max(...cl.map(c => SEVERITY_WEIGHT[c.severity] ?? 1));
    const parts = { incidents: cl.length - 1, recurrences: 2 * (recurrences + reopened), severity: sev, open: openNow ? 3 : 0, recency: fastReturn ? 2 : 0 };
    const resolvedDates = cl.map(c => c.resolved_at).filter(Boolean).sort();
    patterns.push({
      key: cl[0].id,
      category: cl[0].category,
      ward: cl[0].ward ?? null,
      center: { lat: cl.reduce((s, c) => s + c.lat, 0) / cl.length, lng: cl.reduce((s, c) => s + c.lng, 0) / cl.length },
      incidents: cl,
      reportCount: cl.reduce((s, c) => s + 1 + (reportsPerCanonical.get(c.id) ?? 0), 0),
      recurrences,
      reopened,
      firstAt: cl[0].created_at,
      lastAt: cl[cl.length - 1].created_at,
      lastResolvedAt: resolvedDates.length ? resolvedDates[resolvedDates.length - 1]! : null,
      openNow,
      priority: parts.incidents + parts.recurrences + parts.severity + parts.open + parts.recency,
      priorityParts: parts,
      uncertain,
      reason: `${cl.length} distinct incidents within ${RECURRENCE_RULES.radiusM} m; ${recurrences} returned after an earlier repair${reopened ? `, ${reopened} reopened by citizens` : ''}.`,
      suggestion: openNow
        ? (recurrences + reopened >= 2 ? 'Inspect the root cause before another short-term repair.' : 'Check whether the previous repair was adequate.')
        : 'Monitor; schedule a preventive inspection.',
    });
  }
  return patterns.sort((a, b) => b.priority - a.priority);
}

export type CaseMetrics = {
  totalReports: number;
  uniqueIssues: number;
  linkedDuplicateReports: number;
  activeIssues: number;
  resolvedIssues: number;
  reopenedIssues: number;
};

/** Counting rules: an issue is a canonical (unlinked) case; linked reports never count as separate issues. */
export function caseMetrics(cases: IntelCase[]): CaseMetrics {
  const canonical = cases.filter(c => !c.duplicate_of);
  return {
    totalReports: cases.length,
    uniqueIssues: canonical.filter(c => c.status !== 'rejected').length,
    linkedDuplicateReports: cases.length - canonical.length,
    activeIssues: canonical.filter(c => !CLOSED.has(c.status)).length,
    resolvedIssues: canonical.filter(c => c.status === 'resolved' || c.status === 'closed').length,
    reopenedIssues: canonical.filter(c => c.status === 'reopened').length,
  };
}
