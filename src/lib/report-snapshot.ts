import { z } from 'zod';
import { STATUSES, SEVERITIES, CATEGORIES } from './civic';
import type { TransparencyReport } from './transparency';
export const reportFilters = z.object({ coverage_id: z.string().max(60).optional(), start: z.string().datetime({offset:true}).optional(), end: z.string().datetime({offset:true}).optional(), category: z.enum(['', ...CATEGORIES.map(c => c.id)] as [string, ...string[]]).default(''), status: z.enum(['', ...STATUSES]).default(''), severity: z.enum(['', ...SEVERITIES]).default(''), corporation: z.string().max(160).default(''), ward: z.string().max(100).default(''), resolution: z.enum(['', 'resolved', 'unresolved']).default(''), records: z.enum(['canonical', 'linked', 'all']).default('canonical'), include_demo: z.boolean().optional() }).refine(f => !f.start || !f.end || Date.parse(f.start) < Date.parse(f.end), 'Start must precede end');
export type ReportFilters = z.infer<typeof reportFilters>;
export const EMPTY_FILTERS: ReportFilters = { category: '', status: '', severity: '', corporation: '', ward: '', resolution: '', records: 'canonical' };
export type ReportSnapshot = TransparencyReport & { filters: ReportFilters; scope: string; matrix: { category: string; status: string; count: number }[]; recurrence_available: boolean; summary: TransparencyReport['summary'] & { awaiting_acknowledgement: number; in_progress: number; awaiting_verification: number; citizen_confirmed: number; reopened: number; unassigned: number; routing_exceptions: number; linked_duplicates: number; average_response_hours: number | null; response_samples: number; resolution_samples: number } };
export const METHODOLOGY = [
  'Source: persisted Siddhi reports. This is not a census of every civic incident in Bengaluru.',
  'Canonical excludes staff-linked duplicate records. All includes actual linked submissions; linked includes only linked duplicates. History events never count as reports.',
  'Active excludes resolved, closed and rejected. Resolved includes resolved and closed. Resolution rate = resolved / filtered records; undefined when denominator is zero.',
  'Citizen-confirmed counts only closed cases with a recorded citizen_confirmed event. Staff resolution alone is not citizen confirmation.',
  'Overdue uses recorded ETA, otherwise Siddhi target. Internal targets do not establish government promises.',
  'Time charts group creation dates in Asia/Kolkata. Resolved trend counts currently resolved records in each submission cohort, not resolution events on that day.',
  'Durations use valid acknowledgement/resolution timestamps minus submission. Missing values are excluded, not zero; sample counts are disclosed.',
  'Recurring classification is not persisted in this aggregate feed; no recurrence figures are invented. Department details and private report rows are not public exports.',
  'Ward and corporation use submission ward identifiers. Unknown wards remain explicitly unmapped. No private notes, evidence, identities or recovery tokens are included.',
];
export function filterSummary(f: ReportFilters) { return Object.entries(f).filter(([,v]) => v !== '' && v !== undefined).map(([k,v]) => `${k}: ${v}`).join(' · '); }