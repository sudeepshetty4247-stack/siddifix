import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { CATEGORIES } from '@/lib/civic';
import { buildDemoDataset, wardCentroid, type DemoStaff, type DemoTeam } from '@/lib/demo-seed';

const DEMO_EMAIL_DOMAIN = 'siddhi-demo.invalid';

async function assertAdmin(context: { supabase: any; userId: string }) {
  const r = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
  if (!r.data) throw new Error('Administrator access required.');
}
function assertDemoEnabled() {
  if (process.env['DEMO_SEED_ENABLED'] !== 'true')
    throw new Error('Demo seeding is disabled in this environment. It is only enabled in the isolated demo environment so synthetic data can never mix with genuine records.');
}

export const getMasterDataValidation = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const r = await context.supabase.rpc('admin_validate_master_data');
    if (r.error) throw new Error(r.error.message);
    return r.data as { generated_at: string; checks: { check: string; severity: string; count: number; detail: string }[] };
  });

export const getDemoDatasetStatus = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const [issues, teams, profiles] = await Promise.all([
      supabaseAdmin.from('issues').select('demo_dataset_id').not('demo_dataset_id', 'is', null),
      supabaseAdmin.from('civic_teams').select('demo_dataset_id').not('demo_dataset_id', 'is', null),
      supabaseAdmin.from('staff_profiles').select('demo_dataset_id').not('demo_dataset_id', 'is', null),
    ]);
    const tally = (rows: { demo_dataset_id: string }[] | null) => {
      const m = new Map<string, number>();
      for (const r of rows ?? []) m.set(r.demo_dataset_id, (m.get(r.demo_dataset_id) ?? 0) + 1);
      return m;
    };
    const ti = tally(issues.data), tt = tally(teams.data), tp = tally(profiles.data);
    const ids = [...new Set([...ti.keys(), ...tt.keys(), ...tp.keys()])];
    return {
      enabled: process.env['DEMO_SEED_ENABLED'] === 'true',
      datasets: ids.map(id => ({ id, issues: ti.get(id) ?? 0, teams: tt.get(id) ?? 0, staff: tp.get(id) ?? 0 })),
    };
  });

const seedSchema = z.object({
  count: z.number().int().min(50).max(5000).default(1500),
  staffPerDepartment: z.number().int().min(2).max(25).default(10),
  datasetId: z.string().trim().regex(/^[a-z0-9-]{3,40}$/).default('demo-v1'),
});

export const seedDemoDataset = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof seedSchema>) => seedSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    assertDemoEnabled();
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    // Idempotency: a dataset that already exists is never re-seeded or doubled.
    const existing = await supabaseAdmin.from('issues').select('id', { count: 'exact', head: true }).eq('demo_dataset_id', data.datasetId);
    if ((existing.count ?? 0) > 0) return { skipped: true as const, reason: `Dataset ${data.datasetId} already exists with ${existing.count} reports. Purge it first to regenerate.`, created: 0 };

    // Prerequisites: real configured geography and routing must exist first.
    const [wardsR, routesR, targetsR] = await Promise.all([
      supabaseAdmin.from('civic_wards').select('identifier,name,corporation,coverage_id,boundary').eq('active', true),
      supabaseAdmin.from('civic_department_routes').select('category,receiving_office').eq('active', true),
      supabaseAdmin.from('service_targets').select('category,severity,ack_hours,resolve_hours').eq('active', true),
    ]);
    const wards = (wardsR.data ?? [])
      .map(w => ({ identifier: w.identifier as string, name: w.name as string, corporation: (w.corporation as string) ?? null, coverage_id: (w.coverage_id as string) ?? null, c: wardCentroid(w.boundary) }))
      .filter(w => w.c)
      .map(w => ({ identifier: w.identifier, name: w.name, corporation: w.corporation, coverage_id: w.coverage_id, lng: w.c!.lng, lat: w.c!.lat }));
    const routes = routesR.data ?? [];
    if (!wards.length) throw new Error('No active wards with usable boundaries — configure geographic master data first.');
    if (!routes.length) throw new Error('No active category routing rules — configure routing first.');

    // Demo teams: one per receiving office, covering its routed categories.
    const byOffice = new Map<string, string[]>();
    for (const r of routes) byOffice.set(r.receiving_office, [...(byOffice.get(r.receiving_office) ?? []), r.category]);
    const teams: DemoTeam[] = [];
    for (const [office, cats] of byOffice) {
      const id = crypto.randomUUID();
      const ins = await supabaseAdmin.from('civic_teams').insert({
        id, name: `[DEMO] ${office}`.slice(0, 120), department: office, categories: cats, wards: [],
        is_fallback: false, active: true, notes: `Synthetic demo team (${data.datasetId}). Not a real government team.`,
        demo_dataset_id: data.datasetId,
      });
      if (ins.error) throw new Error(`Demo team creation failed: ${ins.error.message}`);
      teams.push({ id, department: office, categories: cats });
    }

    // Demo staff: synthetic auth accounts, provisioned through the same atomic RPC as real staff.
    const staff: DemoStaff[] = [];
    const credentials: { email: string; password: string; department: string; role: string }[] = [];
    let staffSeq = 0;
    for (const team of teams) {
      for (let n = 0; n < data.staffPerDepartment; n++) {
        staffSeq++;
        const role = n === 0 ? 'supervisor' : 'field_worker';
        const email = `demo-${data.datasetId}-${staffSeq}@${DEMO_EMAIL_DOMAIN}`;
        const password = `Demo!${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
        const name = `Demo ${role === 'supervisor' ? 'Supervisor' : 'Officer'} ${staffSeq}`;
        const created = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, demo: true } });
        if (created.error || !created.data.user) { await supabaseAdmin.from('civic_teams').delete().eq('demo_dataset_id', data.datasetId); throw new Error(`Demo account creation failed: ${created.error?.message ?? 'unknown'}`); }
        const provision = await supabaseAdmin.rpc('admin_provision_account', {
          _user: created.data.user.id, _role: role,
          _profile: { fullName: name, designation: role === 'supervisor' ? 'Demo Supervisor' : 'Demo Field Officer', department: team.department, categories: team.categories, wards: [], teamIds: [team.id], corporations: [] },
          _actor: context.userId,
        });
        if (provision.error) { await supabaseAdmin.auth.admin.deleteUser(created.data.user.id); throw new Error(`Demo provisioning failed: ${provision.error.message}`); }
        await supabaseAdmin.from('staff_profiles').update({ demo_dataset_id: data.datasetId }).eq('user_id', created.data.user.id);
        staff.push({ id: created.data.user.id, team_id: team.id, department: team.department, categories: team.categories, name });
        credentials.push({ email, password, department: team.department, role });
      }
    }

    const categories = CATEGORIES.filter(c => routes.some(r => r.category === c.id)).map(c => ({ id: c.id, subs: [...c.subs] }));
    const dataset = buildDemoDataset({ datasetId: data.datasetId, count: data.count, wards, teams, staff, targets: targetsR.data ?? [], categories });

    const batch = 250;
    const rejected: string[] = [];
    for (let i = 0; i < dataset.issues.length; i += batch) {
      const ins = await supabaseAdmin.from('issues').insert(dataset.issues.slice(i, i + batch));
      if (ins.error) rejected.push(`issues ${i}-${i + batch}: ${ins.error.message}`);
    }
    const issueIds = dataset.issues.map(x => x.id);
    const staffIds = staff.map(s => s.id);
    for (let i = 0; i < dataset.events.length; i += batch) {
      const rows = dataset.events.slice(i, i + batch).map(e => ({ issue_id: issueIds[e.issue_index], kind: e.kind, from_status: e.from_status, to_status: e.to_status, note: e.note, actor_label: e.actor_label, created_at: e.created_at, visibility: e.visibility }));
      const ins = await supabaseAdmin.from('issue_events').insert(rows);
      if (ins.error) rejected.push(`events ${i}: ${ins.error.message}`);
    }
    for (let i = 0; i < dataset.notifications.length; i += batch) {
      const rows = dataset.notifications.slice(i, i + batch).map(n => ({ issue_id: issueIds[n.issue_index], recipient_user_id: staffIds[n.recipient_index] ?? null, audience: 'staff', channel: 'in_app', status: 'recorded', notification_type: n.notification_type, title: n.title, detail: n.detail, priority: n.priority, created_at: n.created_at }));
      const ins = await supabaseAdmin.from('issue_notifications').insert(rows);
      if (ins.error) rejected.push(`notifications ${i}: ${ins.error.message}`);
    }
    for (let i = 0; i < dataset.feedback.length; i += batch) {
      const rows = dataset.feedback.slice(i, i + batch).map(f => ({ issue_id: issueIds[f.issue_index], rating: f.rating, resolution: f.resolution, response_time: f.response_time, comment: f.comment, status_at_submission: f.status_at_submission, submitted_at: f.submitted_at }));
      const ins = await supabaseAdmin.from('issue_feedback').insert(rows);
      if (ins.error) rejected.push(`feedback ${i}: ${ins.error.message}`);
    }
    for (let i = 0; i < dataset.secrets.length; i += batch) {
      const rows = dataset.secrets.slice(i, i + batch).map(s => ({ issue_id: issueIds[s.issue_index], recovery_token: s.token, demo_dataset_id: data.datasetId }));
      const ins = await supabaseAdmin.from('issue_secrets').insert(rows);
      if (ins.error) rejected.push(`secrets ${i}: ${ins.error.message}`);
    }

    return {
      skipped: false as const, dataset: data.datasetId, created: dataset.issues.length - rejected.length,
      rejected, teams: teams.length, staff: staff.length,
      events: dataset.events.length, notifications: dataset.notifications.length, feedback: dataset.feedback.length,
      credentials,
      note: 'Synthetic demonstration data only. Excluded from public metrics. Demo account passwords are shown once — store them securely and only in the demo environment.',
    };
  });

export const purgeDemoDataset = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { datasetId: string }) => z.object({ datasetId: z.string().trim().min(3).max(40) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    assertDemoEnabled();
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    // Remove demo auth accounts (SQL cannot), then purge every tagged row atomically.
    let removedUsers = 0;
    for (let page = 1; page <= 20; page++) {
      const list = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      const demoUsers = (list.data?.users ?? []).filter(u => u.email?.startsWith(`demo-${data.datasetId}-`) && u.email.endsWith(`@${DEMO_EMAIL_DOMAIN}`));
      for (const u of demoUsers) { await supabaseAdmin.auth.admin.deleteUser(u.id); removedUsers++; }
      if ((list.data?.users?.length ?? 0) < 200) break;
    }
    const r = await context.supabase.rpc('purge_demo_dataset', { _dataset: data.datasetId });
    if (r.error) throw new Error(r.error.message);
    return { ...(r.data as object), authUsersRemoved: removedUsers };
  });
