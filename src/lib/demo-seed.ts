// Deterministic synthetic demo dataset generator. Pure module: no server or browser imports,
// so the same logic is unit-tested and reused by the gated seeding server function.
// Every record carries demo_dataset_id; demo rows are excluded from public metrics.

export type DemoWard = { identifier: string; name: string; corporation: string | null; coverage_id: string | null; lng: number; lat: number };
export type DemoTeam = { id: string; department: string; categories: string[] };
export type DemoStaff = { id: string; team_id: string; department: string; categories: string[]; name: string };
export type DemoTarget = { category: string; severity: string; ack_hours: number; resolve_hours: number };

export type DemoIssue = {
  id: string; ref_code: string; idempotency_key: string; title: string; summary: string; description: string;
  photo_url: string | null;
  category: string; subcategory: string; severity: 'low' | 'medium' | 'high' | 'critical';
  status: string; lat: number; lng: number; landmark: string; department: string | null;
  assigned_to: string | null; team_id: string | null; duplicate_of: string | null;
  support_count: number; sla_due_at: string | null; ack_due_at: string | null;
  acknowledged_at: string | null; acknowledged_by: string | null; resolved_at: string | null;
  escalated_at: string | null; created_at: string; updated_at: string;
  routing_snapshot: Record<string, unknown>; assignment_state: string; demo_dataset_id: string;
};
export type DemoEvent = { issue_index: number; kind: string; from_status: string | null; to_status: string | null; note: string; actor_label: string; created_at: string; visibility: string };
export type DemoNotification = { issue_index: number; recipient_index: number; notification_type: string; title: string; detail: string; priority: string; created_at: string };
export type DemoFeedback = { issue_index: number; rating: number; resolution: string; response_time: string; comment: string; status_at_submission: string; submitted_at: string };
export type DemoDataset = { issues: DemoIssue[]; events: DemoEvent[]; notifications: DemoNotification[]; feedback: DemoFeedback[]; secrets: { issue_index: number; token: string }[] };

/** Lifecycle buckets mapped to the real status state machine. Fractions sum to 1 (2,100-report plan). */
export const STATUS_MIX = [
  { key: 'closed', fraction: 350 / 2100 },        // resolved and citizen-confirmed, with feedback
  { key: 'resolved', fraction: 250 / 2100 },      // resolved, awaiting citizen confirmation
  { key: 'in_progress', fraction: 350 / 2100 },
  { key: 'pending_ack', fraction: 200 / 2100 },   // routed, nobody acknowledged yet
  { key: 'assigned_unack', fraction: 200 / 2100 },
  { key: 'overdue', fraction: 200 / 2100 },       // open past the resolution target
  { key: 'unassigned', fraction: 150 / 2100 },    // routing exception
  { key: 'reopened', fraction: 150 / 2100 },
  { key: 'new', fraction: 250 / 2100 },           // submitted in the last day
] as const;
export type BucketKey = (typeof STATUS_MIX)[number]['key'];

const SEVERITY_WEIGHTS: [DemoIssue['severity'], number][] = [['critical', 0.05], ['high', 0.2], ['medium', 0.5], ['low', 0.25]];
const OPEN_STATUSES = new Set(['submitted', 'assigned', 'in_progress', 'reopened', 'needs_classification', 'under_review']);

/** Deterministic PRNG so a dataset id always regenerates the same content. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function datasetSeed(datasetId: string) {
  let h = 2166136261;
  for (let i = 0; i < datasetId.length; i++) { h ^= datasetId.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function bucketForIndex(i: number, count: number): BucketKey {
  const pos = i / count;
  let acc = 0;
  for (const b of STATUS_MIX) { acc += b.fraction; if (pos < acc) return b.key; }
  return 'new';
}

const pick = <T,>(rnd: () => number, list: readonly T[]) => list[Math.floor(rnd() * list.length)]!;
const hoursAgo = (now: number, h: number) => new Date(now - h * 3600000).toISOString();

export function buildDemoDataset(args: {
  datasetId: string; count: number; now?: number;
  wards: DemoWard[]; teams: DemoTeam[]; staff: DemoStaff[]; targets: DemoTarget[];
  categories: { id: string; subs: string[] }[];
  photos?: Record<string, string[]>;
}): DemoDataset {
  const { datasetId, count, wards, teams, staff, targets, categories } = args;
  const photos = args.photos ?? {};
  const now = args.now ?? Date.now();
  const rnd = mulberry32(datasetSeed(datasetId));
  const issues: DemoIssue[] = [];
  const events: DemoEvent[] = [];
  const notifications: DemoNotification[] = [];
  const feedback: DemoFeedback[] = [];
  const secrets: DemoDataset['secrets'] = [];
  const canonicalByCategory = new Map<string, number[]>();

  for (let i = 0; i < count; i++) {
    const bucket = bucketForIndex(i, count);
    const ward = pick(rnd, wards);
    const cat = pick(rnd, categories);
    const sevRoll = rnd();
    let acc = 0; let severity: DemoIssue['severity'] = 'low';
    for (const [s, w] of SEVERITY_WEIGHTS) { acc += w; if (sevRoll < acc) { severity = s; break; } }
    const target = targets.find(t => t.category === cat.id && t.severity === severity)
      ?? { ack_hours: { critical: 4, high: 12, medium: 48, low: 72 }[severity], resolve_hours: { critical: 24, high: 72, medium: 168, low: 336 }[severity] };

    const team = teams.find(t => t.categories.includes(cat.id)) ?? null;
    const members = team ? staff.filter(s => s.team_id === team.id) : [];
    const handler = members.length ? pick(rnd, members) : null;

    // Timeline: created first, then acknowledgement, progress, resolution — never out of order.
    const createdHoursBack = bucket === 'new' ? rnd() * 20 : 24 + rnd() * 90 * 24;
    let created = now - createdHoursBack * 3600000;
    // Duplicate linking is decided before the timeline so a linked report never predates its incident.
    const isDuplicate = bucket !== 'unassigned' && rnd() < 0.05 && (canonicalByCategory.get(cat.id)?.length ?? 0) > 0;
    const duplicateTarget = isDuplicate ? issues[pick(rnd, canonicalByCategory.get(cat.id)!)]! : null;
    if (duplicateTarget) created = Math.max(created, new Date(duplicateTarget.created_at).getTime() + 3600000);
    const ackDue = created + target.ack_hours * 3600000;
    const resolveDue = created + target.resolve_hours * 3600000;
    const lat = ward.lat + (rnd() - 0.5) * 0.004;
    const lng = ward.lng + (rnd() - 0.5) * 0.004;
    const sub = pick(rnd, cat.subs);
    const ref = `DEMO-${datasetId.toUpperCase()}-${String(i + 1).padStart(5, '0')}`;

    let status = 'submitted';
    let acknowledged_at: string | null = null, resolved_at: string | null = null, escalated_at: string | null = null;
    let assignment_state = team ? 'assigned' : 'exception';
    let department = team?.department ?? null;

    if (bucket === 'unassigned') { status = 'needs_classification'; assignment_state = 'exception'; department = null; }
    else if (bucket === 'assigned_unack') status = 'assigned';
    else if (bucket === 'pending_ack') status = 'submitted';
    else if (bucket !== 'new') {
      acknowledged_at = new Date(Math.min(created + rnd() * target.ack_hours * 3600000, now - 3600000)).toISOString();
      if (bucket === 'in_progress') status = 'in_progress';
      if (bucket === 'overdue') { status = rnd() < 0.5 ? 'assigned' : 'in_progress'; if (rnd() < 0.5) escalated_at = hoursAgo(now, rnd() * 48); }
      if (bucket === 'resolved' || bucket === 'closed' || bucket === 'reopened') {
        resolved_at = new Date(Math.min(created + (0.3 + rnd() * 0.6) * target.resolve_hours * 3600000, now - 2 * 3600000)).toISOString();
        status = bucket === 'reopened' ? 'reopened' : bucket;
      }
    }
    if (bucket === 'overdue') acknowledged_at = new Date(Math.min(now - 3600000, created + rnd() * target.ack_hours * 3600000)).toISOString();


    const catPhotos = photos[cat.id] ?? [];
    issues.push({
      id: crypto.randomUUID(),
      photo_url: catPhotos.length && rnd() < 0.7 ? pick(rnd, catPhotos) : null,
      ref_code: ref, idempotency_key: ref, title: `${sub} near ${ward.name}`, summary: `${sub} reported in ${ward.name}.`,
      description: `Synthetic demonstration report (${datasetId}). ${sub} observed near ${ward.name}; generated for workflow testing only.`,
      category: cat.id, subcategory: sub, severity, status, lat, lng,
      landmark: `Demo landmark ${Math.floor(rnd() * 900) + 100}, ${ward.name}`,
      department, assigned_to: handler?.id ?? null, team_id: team?.id ?? null,
      duplicate_of: duplicateTarget?.id ?? null, support_count: 1 + Math.floor(rnd() * 3),
      sla_due_at: new Date(resolveDue).toISOString(), ack_due_at: new Date(ackDue).toISOString(),
      acknowledged_at, acknowledged_by: acknowledged_at ? handler?.id ?? null : null,
      resolved_at, escalated_at, created_at: new Date(created).toISOString(), updated_at: new Date(Math.min(now, created + 3600000)).toISOString(),
      routing_snapshot: { ward: { identifier: ward.identifier, name: ward.name }, coverage: ward.coverage_id ? { id: ward.coverage_id } : undefined, source: 'demo', demo: true },
      assignment_state, demo_dataset_id: datasetId,
    });
    if (!isDuplicate && (OPEN_STATUSES.has(status) || status === 'resolved' || status === 'closed')) {
      const list = canonicalByCategory.get(cat.id) ?? []; list.push(i); canonicalByCategory.set(cat.id, list);
    }
    secrets.push({ issue_index: i, token: `demo-token-${datasetId}-${i + 1}` });

    events.push({ issue_index: i, kind: 'created', from_status: null, to_status: status, note: 'Synthetic demo report recorded.', actor_label: 'Demo citizen', created_at: new Date(created).toISOString(), visibility: 'public' });
    if (acknowledged_at) events.push({ issue_index: i, kind: 'acknowledged', from_status: 'submitted', to_status: status === 'submitted' ? 'assigned' : status, note: 'Demo acknowledgement.', actor_label: handler?.name ?? 'Demo staff', created_at: acknowledged_at, visibility: 'public' });
    if (resolved_at) events.push({ issue_index: i, kind: 'status', from_status: 'in_progress', to_status: 'resolved', note: 'Demo resolution submitted.', actor_label: handler?.name ?? 'Demo staff', created_at: resolved_at, visibility: 'public' });
    if (bucket === 'closed' && resolved_at) {
      const confirmedAt = new Date(Math.min(new Date(resolved_at).getTime() + rnd() * 48 * 3600000, now - 3600000)).toISOString();
      events.push({ issue_index: i, kind: 'citizen_confirmed', from_status: 'resolved', to_status: 'closed', note: 'Demo citizen confirmed the resolution.', actor_label: 'Demo citizen', created_at: confirmedAt, visibility: 'public' });
      feedback.push({ issue_index: i, rating: rnd() < 0.6 ? 5 : rnd() < 0.8 ? 4 : 3, resolution: 'complete', response_time: pick(rnd, ['excellent', 'good', 'average'] as const), comment: 'Synthetic demo feedback.', status_at_submission: 'closed', submitted_at: confirmedAt });
    }
    if (bucket === 'reopened' && resolved_at) events.push({ issue_index: i, kind: 'citizen_reopened', from_status: 'resolved', to_status: 'reopened', note: 'Demo citizen reported the problem is back.', actor_label: 'Demo citizen', created_at: hoursAgo(now, rnd() * 24), visibility: 'public' });
    if (escalated_at) events.push({ issue_index: i, kind: 'escalated', from_status: null, to_status: null, note: 'Demo deadline escalation.', actor_label: 'System', created_at: escalated_at, visibility: 'internal' });

    if (handler && acknowledged_at) notifications.push({ issue_index: i, recipient_index: staff.indexOf(handler), notification_type: 'assignment', title: `Demo case ${ref} assigned`, detail: `${sub} in ${ward.name}`, priority: severity === 'critical' ? 'critical' : 'normal', created_at: new Date(created + 60000).toISOString() });
    if (severity === 'critical' && OPEN_STATUSES.has(status)) notifications.push({ issue_index: i, recipient_index: handler ? staff.indexOf(handler) : 0, notification_type: 'critical_alert', title: `Critical demo case ${ref}`, detail: `${sub} in ${ward.name} needs immediate acknowledgement.`, priority: 'critical', created_at: new Date(created + 30000).toISOString() });
  }
  return { issues, events, notifications, feedback, secrets };
}

/** Centroid of a GeoJSON Polygon/MultiPolygon boundary, used to place demo reports inside a ward. */
export function wardCentroid(boundary: unknown): { lng: number; lat: number } | null {
  try {
    const b = boundary as { coordinates?: number[][][][] };
    const ring = b?.coordinates?.[0]?.[0];
    if (!Array.isArray(ring) || !ring.length) return null;
    let sx = 0, sy = 0;
    for (const [x, y] of ring) { sx += x!; sy += y!; }
    return { lng: sx / ring.length, lat: sy / ring.length };
  } catch { return null; }
}
