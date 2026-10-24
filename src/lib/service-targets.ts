import { SEVERITY_META, type Severity } from './civic';

export type ServiceTarget = { category: string; severity: Severity; ack_hours: number; resolve_hours: number; version: number; active: boolean };
export type TargetSnapshot = { source: 'configured' | 'default'; category: string; severity: Severity; ack_hours: number; resolve_hours: number; version: number | null; calculated_at: string; basis: 'calendar_hours' };

/** Default acknowledgement windows used only when no active configured target exists. */
export const DEFAULT_ACK_HOURS: Record<Severity, number> = { critical: 4, high: 12, medium: 48, low: 72 };

/**
 * Internal Siddi service targets: calendar hours from the creation time.
 * Picks the active configured rule for category+severity, otherwise the severity default.
 */
export function computeTargets(targets: ServiceTarget[], category: string, severity: Severity, createdAt: Date) {
  const rule = targets.find(t => t.active && t.category === category && t.severity === severity);
  const ack = rule?.ack_hours ?? DEFAULT_ACK_HOURS[severity];
  const resolve = rule?.resolve_hours ?? SEVERITY_META[severity].slaHours;
  const snapshot: TargetSnapshot = { source: rule ? 'configured' : 'default', category, severity, ack_hours: ack, resolve_hours: resolve, version: rule?.version ?? null, calculated_at: createdAt.toISOString(), basis: 'calendar_hours' };
  return {
    ackDueAt: new Date(createdAt.getTime() + ack * 3600000).toISOString(),
    resolveDueAt: new Date(createdAt.getTime() + resolve * 3600000).toISOString(),
    snapshot,
  };
}

export type DeadlineState = { label: string; overdue: boolean; reason: string | null };
/** Human remaining/overdue text for a due date; closed cases are never overdue. */
export function deadlineState(due: string | null, open: boolean, kind: 'acknowledgement' | 'resolution', now = Date.now()): DeadlineState | null {
  if (!due) return null;
  const diff = new Date(due).getTime() - now;
  const h = Math.round(Math.abs(diff) / 3600000);
  const span = h >= 48 ? `${Math.round(h / 24)} days` : `${Math.max(h, 1)} h`;
  if (!open) return { label: 'Closed', overdue: false, reason: null };
  if (diff >= 0) return { label: `${span} left`, overdue: false, reason: null };
  return { label: `${span} overdue`, overdue: true, reason: `The Siddi ${kind} target passed ${span} ago.` };
}
