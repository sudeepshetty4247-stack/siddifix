import { z } from 'zod';

export const notificationFilters = z.object({
  state: z.enum(['all', 'unread', 'read', 'archived']).default('all'),
  type: z.string().max(60).default(''),
  priority: z.enum(['', 'normal', 'high', 'critical']).default(''),
  search: z.string().trim().max(120).default(''),
  page: z.number().int().min(0).max(10000).default(0),
});
export const notificationAction = z.object({
  id: z.string().uuid().nullable(),
  action: z.enum(['read', 'unread', 'archive', 'restore', 'read_all']),
}).superRefine((v, ctx) => {
  if (v.action !== 'read_all' && !v.id) ctx.addIssue({ code: 'custom', message: 'Notification required.' });
  if (v.action === 'read_all' && v.id) ctx.addIssue({ code: 'custom', message: 'Bulk action must not target an ID.' });
});
export const NOTIFICATION_TYPES = ['new_report', 'assignment', 'acknowledgement_required', 'acknowledged', 'public_update', 'citizen_update', 'escalation', 'deadline_approaching', 'deadline_breached', 'resolution_submitted', 'resolution_confirmed', 'case_reopened', 'reassignment', 'supervisor_instruction', 'system', 'routing_exception'] as const;
export function notificationLabel(type: string) {
  return type.replaceAll('_', ' ').replace(/^./, s => s.toUpperCase());
}