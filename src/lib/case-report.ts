import type { PublicCase } from './public-cases';
import type { EventRow } from '@/components/civic/Timeline';
export function caseReport(i: PublicCase, events: EventRow[]) {
  const snapshot = i.routing_snapshot as { ward?: { name?: string; identifier?: string; corporation?: string; assembly?: string; lok_sabha?: string } } | null;
  const rows = [
    '# Siddi — Your City. Your Voice.', `## Public case report: ${i.ref_code}`, `Generated: ${new Date().toISOString()}`,
    `Title: ${i.title}`, `Status: ${i.status}`, `Category: ${i.category}`, `Severity: ${i.severity}`, `Reported: ${i.created_at}`, `Last updated: ${i.updated_at}`,
    `Location: ${i.landmark ?? 'Confirmed report location on case map'}`, `Ward recorded at submission: ${snapshot?.ward?.name ?? 'Manual review required'}`, `Corporation: ${snapshot?.ward?.corporation ?? 'Review required'}`,
    `Assembly: ${snapshot?.ward?.assembly ?? 'Verification required'}`, `Lok Sabha constituency: ${snapshot?.ward?.lok_sabha ?? 'Verification required'}`,
    `Recorded department: ${i.department ?? 'Ownership review pending'}`, `Acknowledged: ${i.acknowledged_at ?? 'Not recorded'}`, `Staff response: ${i.ack_message ?? 'Not recorded'}`, `Inspection: ${i.inspection_at ?? 'Not recorded'}`, `Staff ETA: ${i.eta_at ?? 'Not recorded'}`, `Siddi internal target: ${i.sla_due_at ?? 'Not recorded'}`, `Resolved: ${i.resolved_at ?? 'Not recorded'}`,
    '', '## Citizen description', i.description ?? '', '## Recorded summary', i.summary ?? '', '', '## Public action history',
    ...events.map(e => `${e.created_at} · ${e.kind}${e.to_status ? ` → ${e.to_status}` : ''}\n${e.note ?? ''}${e.actor_label ? `\nRecorded by: ${e.actor_label}` : ''}`),
    '', '## Scope and privacy', 'This is an independent Siddi public record, not an official government report. Targets and estimates do not establish government commitments. MLA/MP constituency links do not establish repair ownership. Private original photos, recovery capabilities and internal staff notes are excluded. Current verified authority sources and resolution evidence are available on the public case page.',
    `Public case: /issues/${i.ref_code}`,
  ];
  return rows.join('\n\n');
}