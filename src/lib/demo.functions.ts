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
    throw new Error('Demo seeding is disabled in this environment.');
}

/** Deterministic UUID from a string so resumed seed runs reuse the same teams. */
function deterministicUuid(seed: string) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(1, 4)}-${hex.slice(4, 16)}`.slice(0, 36);
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
    const issueRows: {demo_dataset_id:string|null}[] = [];
    for(let offset=0;offset<100000;offset+=1000) {
      const page=await supabaseAdmin.from('issues').select('demo_dataset_id').not('demo_dataset_id','is',null).order('id').range(offset,offset+999);
      if(page.error) throw new Error('Demo totals unavailable');
      issueRows.push(...page.data); if(page.data.length<1000) break;
    }
    const [teams, profiles] = await Promise.all([
      supabaseAdmin.from('civic_teams').select('demo_dataset_id').not('demo_dataset_id', 'is', null),
      supabaseAdmin.from('staff_profiles').select('demo_dataset_id').not('demo_dataset_id', 'is', null),
    ]);
    const tally = (rows: { demo_dataset_id: string | null }[] | null) => {
      const m = new Map<string, number>();
      for (const r of rows ?? []) { if (r.demo_dataset_id) m.set(r.demo_dataset_id, (m.get(r.demo_dataset_id) ?? 0) + 1); }
      return m;
    };
    const ti = tally(issueRows), tt = tally(teams.data), tp = tally(profiles.data);
    const ids = [...new Set([...ti.keys(), ...tt.keys(), ...tp.keys()])];
    return {
      enabled: process.env['DEMO_SEED_ENABLED'] === 'true',
      datasets: ids.map(id => ({ id, issues: ti.get(id) ?? 0, teams: tt.get(id) ?? 0, staff: tp.get(id) ?? 0 })),
    };
  });

export const previewDemoPurge = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { datasetId: string }) => z.object({ datasetId: z.string().trim().min(3).max(40) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const r = await context.supabase.rpc('preview_demo_purge', { _dataset: data.datasetId });
    if (r.error) throw new Error(r.error.message);
    return r.data as Record<string, number | string | boolean>;
  });

export const resetDemoCredentials = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { datasetId: string }) => z.object({ datasetId: z.string().regex(/^[a-z0-9-]{3,40}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context); assertDemoEnabled();
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const rows = await supabaseAdmin.from('staff_profiles').select('user_id,department').eq('demo_dataset_id',data.datasetId);
    if(rows.error) throw new Error('Demo accounts unavailable');
    const credentials: { email: string; password: string; department: string; role: string }[] = [];
    for(const row of rows.data ?? []) {
      const account = await supabaseAdmin.auth.admin.getUserById(row.user_id);
      const email = account.data.user?.email;
      if(!email?.startsWith(`demo-${data.datasetId}-`) || !email.endsWith(`@${DEMO_EMAIL_DOMAIN}`)) throw new Error('Account labelling mismatch; reset refused');
      const password = `Demo!${crypto.randomUUID().replaceAll('-','').slice(0,20)}`;
      const result = await supabaseAdmin.auth.admin.updateUserById(row.user_id,{password});
      if(result.error) throw new Error('Demo password reset failed');
      const role = await supabaseAdmin.from('user_roles').select('role').eq('user_id',row.user_id).single();
      credentials.push({email,password,department:row.department,role:role.data?.role ?? 'unknown'});
    }
    return credentials;
  });

const seedSchema = z.object({
  count: z.number().int().min(50).max(5000).default(2100),
  staffPerDepartment: z.number().int().min(2).max(25).default(10),
  datasetId: z.string().trim().regex(/^[a-z0-9-]{3,40}$/).default('demo-v1'),
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(500).default(500),
});

/** Licensed demo photographs (see public/demo-media/CREDITS.md), matched to report category. */
const DEMO_PHOTOS: Record<string, string[]> = {
  roads: ['/demo-media/roads-bengaluru-munnekollala.jpg', '/demo-media/roads-potholes-driving.jpg', '/demo-media/roads-potholes.jpg', '/demo-media/roads-broken-delhi.jpg'],
  drainage: ['/demo-media/drainage-bda-rain-1.jpg', '/demo-media/drainage-bda-rain-2.jpg', '/demo-media/drainage-storm-drain.jpg'],
  water: ['/demo-media/drainage-storm-drain.jpg'],
  electricity: ['/demo-media/electricity-streetlight-off.jpg', '/demo-media/electricity-streetlight.jpg'],
  waste: ['/demo-media/waste-garbage-panvel.jpg', '/demo-media/waste-garbage-municipal.jpg'],
  sanitation: ['/demo-media/waste-garbage-municipal.jpg'],
  trees: ['/demo-media/trees-fallen.jpg'],
  transport: ['/demo-media/transport-auto-bangalore.jpg'],
};

/**
 * Resumable demo seeder. Teams and staff are ensured first (deterministic, never doubled);
 * reports are inserted in slices [offset, offset+limit) so a long run survives timeouts —
 * the admin page calls it repeatedly until done. Existing refs are skipped, so retries are safe.
 */
export const seedDemoDataset = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof seedSchema>) => seedSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    assertDemoEnabled();
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    const [wardsR, routesR, targetsR] = await Promise.all([
      supabaseAdmin.from('civic_wards').select('identifier,name,corporation,coverage_id,boundary').eq('active', true).order('identifier'),
      supabaseAdmin.from('civic_department_routes').select('category,receiving_office').eq('active', true).order('category'),
      supabaseAdmin.from('service_targets').select('category,severity,ack_hours,resolve_hours').eq('active', true),
    ]);
    const wards = (wardsR.data ?? [])
      .map(w => ({ identifier: w.identifier as string, name: w.name as string, corporation: (w.corporation as string) ?? null, coverage_id: (w.coverage_id as string) ?? null, c: wardCentroid(w.boundary) }))
      .flatMap(w => w.c ? [{ identifier: w.identifier, name: w.name, corporation: w.corporation, coverage_id: w.coverage_id, lng: w.c.lng, lat: w.c.lat }] : []);
    const routes = routesR.data ?? [];
    if (!wards.length) throw new Error('No active wards with usable boundaries — configure geographic master data first.');
    if (!routes.length) throw new Error('No active category routing rules — configure routing first.');

    // Ensure demo teams (deterministic ids; existing ones are reused).
    const byOffice = new Map<string, string[]>();
    for (const r of routes) byOffice.set(r.receiving_office, [...(byOffice.get(r.receiving_office) ?? []), r.category]);
    const teams: DemoTeam[] = [];
    for (const [office, cats] of byOffice) {
      const id = deterministicUuid(`${data.datasetId}:team:${office}`);
      const existing = await supabaseAdmin.from('civic_teams').select('id').eq('id', id).maybeSingle();
      if (!existing.data) {
        const ins = await supabaseAdmin.from('civic_teams').insert({
          id, name: `[DEMO] ${office}`.slice(0, 120), department: office, categories: cats, wards: [],
          is_fallback: false, active: true, notes: `Synthetic demo team (${data.datasetId}). Not a real government team.`,
          demo_dataset_id: data.datasetId,
        });
        if (ins.error) throw new Error(`Demo team creation failed: ${ins.error.message}`);
      }
      teams.push({ id, department: office, categories: cats });
    }

    // Ensure demo staff (deterministic emails; existing profiles are reused).
    const staff: DemoStaff[] = [];
    const credentials: { email: string; password: string; department: string; role: string }[] = [];
    const existingProfiles = await supabaseAdmin.from('staff_profiles').select('user_id,team_ids,department,categories,display_name').eq('demo_dataset_id', data.datasetId);
    for (const p of existingProfiles.data ?? []) {
      const teamId = (p.team_ids as string[] | null)?.[0];
      if (teamId) staff.push({ id: p.user_id as string, team_id: teamId, department: p.department as string, categories: (p.categories as string[]) ?? [], name: (p.display_name as string) ?? 'Demo staff' });
    }
    // Create missing demo staff in parallel batches (sequential creation is too slow for a full demo org).
    const toCreate: { team: DemoTeam; n: number; role: string; email: string; password: string; name: string }[] = [];
    for (const team of teams) {
      const have = staff.filter(s => s.team_id === team.id).length;
      for (let n = have; n < data.staffPerDepartment; n++) {
        const seq = teams.indexOf(team) * 25 + n + 1;
        const role = n === 0 ? 'supervisor' : 'field_worker';
        toCreate.push({
          team, n, role,
          email: `demo-${data.datasetId}-${seq}@${DEMO_EMAIL_DOMAIN}`,
          password: `Demo!${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`,
          name: `Demo ${role === 'supervisor' ? 'Supervisor' : 'Officer'} ${seq}`,
        });
      }
    }
    for (let i = 0; i < toCreate.length; i += 10) {
      const results = await Promise.all(toCreate.slice(i, i + 10).map(async c => {
        const created = await supabaseAdmin.auth.admin.createUser({ email: c.email, password: c.password, email_confirm: true, user_metadata: { full_name: c.name, demo: true } });
        if (created.error || !created.data.user) {
          if (created.error?.message?.includes('already been registered')) return null;
          throw new Error(`Demo account creation failed: ${created.error?.message ?? 'unknown'}`);
        }
        const provision = await supabaseAdmin.rpc('admin_provision_account', {
          _user: created.data.user.id, _role: c.role,
          _profile: { fullName: c.name, designation: c.role === 'supervisor' ? 'Demo Supervisor' : 'Demo Field Officer', department: c.team.department, categories: c.team.categories, wards: [], teamIds: [c.team.id], corporations: [] },
          _actor: context.userId,
        });
        if (provision.error) { await supabaseAdmin.auth.admin.deleteUser(created.data.user.id); throw new Error(`Demo provisioning failed: ${provision.error.message}`); }
        await supabaseAdmin.from('staff_profiles').update({ demo_dataset_id: data.datasetId }).eq('user_id', created.data.user.id);
        return { c, id: created.data.user.id };
      }));
      for (const r of results) {
        if (!r) continue;
        staff.push({ id: r.id, team_id: r.c.team.id, department: r.c.team.department, categories: r.c.team.categories, name: r.c.name });
        credentials.push({ email: r.c.email, password: r.c.password, department: r.c.team.department, role: r.c.role });
      }
    }

    // One demo admin account so the presenter can show the Admin Control Centre.
    let adminCredential: { email: string; password: string } | null = null;
    if (data.offset === 0) {
      const adminEmail = `demo-${data.datasetId}-admin@${DEMO_EMAIL_DOMAIN}`;
      const existingAdmin = await supabaseAdmin.from('staff_profiles').select('user_id').eq('demo_dataset_id', data.datasetId).eq('department', 'Demo Administration').maybeSingle();
      if (!existingAdmin.data) {
        const password = `Demo!${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
        const created = await supabaseAdmin.auth.admin.createUser({ email: adminEmail, password, email_confirm: true, user_metadata: { full_name: 'Demo Administrator', demo: true } });
        if (!created.error && created.data.user) {
          const provision = await supabaseAdmin.rpc('admin_provision_account', {
            _user: created.data.user.id, _role: 'admin',
            _profile: { fullName: 'Demo Administrator', designation: 'Demo Administrator', department: 'Demo Administration', categories: [], wards: [], teamIds: [], corporations: [] },
            _actor: context.userId,
          });
          if (!provision.error) {
            await supabaseAdmin.from('staff_profiles').update({ demo_dataset_id: data.datasetId }).eq('user_id', created.data.user.id);
            adminCredential = { email: adminEmail, password };
          } else {
            await supabaseAdmin.auth.admin.deleteUser(created.data.user.id);
          }
        }
      }
    }

    if (staff.length < teams.length * data.staffPerDepartment) throw new Error('Synthetic staff setup incomplete; no reports were inserted. Retry setup.');
    const categories = CATEGORIES.filter(c => routes.some(r => r.category === c.id)).map(c => ({ id: c.id, subs: [...c.subs] }));
    staff.sort((a,b) => a.name.localeCompare(b.name));
    const dataset = buildDemoDataset({ datasetId: data.datasetId, count: data.count, wards, teams, staff, targets: targetsR.data ?? [], categories, photos: DEMO_PHOTOS });
    const slice = dataset.issues.slice(data.offset, data.offset + data.limit);
    const issueId = (index: number) => dataset.issues[index]?.id ?? null;
    const indices = new Set(slice.map(i => i.id));
    const inBatch = (index: number) => indices.has(issueId(index) ?? '');
    const result = await supabaseAdmin.rpc('seed_demo_batch', {
      _dataset: data.datasetId, _issues: slice as never,
      _events: dataset.events.filter(e => inBatch(e.issue_index)).map(e => ({ ...e, issue_id: issueId(e.issue_index) })) as never,
      _notifications: dataset.notifications.filter(n => inBatch(n.issue_index) && staff[n.recipient_index]).map(n => ({ ...n, issue_id: issueId(n.issue_index), recipient_user_id: staff[n.recipient_index]?.id })) as never,
      _feedback: dataset.feedback.filter(f => inBatch(f.issue_index)).map(f => ({ ...f, issue_id: issueId(f.issue_index) })) as never,
      _secrets: dataset.secrets.filter(s => inBatch(s.issue_index)).map(s => ({ issue_id: issueId(s.issue_index), recovery_token: s.token })) as never,
    });
    if (result.error) throw new Error(`Demo batch rolled back: ${result.error.message}`);
    const counts = result.data as { inserted: number; skipped: number };
    // Demo photos are licensed static assets referenced by photo_url only; private issue_photos
    // storage rows are intentionally not created (they are reserved for genuine citizen uploads).

    const nextOffset = data.offset + data.limit;
    const done = nextOffset >= data.count;
    // Presenter tracking links: first few demo refs with their tokens.
    const samples = data.offset === 0
      ? dataset.issues.slice(0, 5).map((iss, i) => ({ ref: iss.ref_code, token: dataset.secrets[i]?.token ?? '', status: iss.status }))
      : undefined;

    return {
      dataset: data.datasetId, done, nextOffset: done ? null : nextOffset,
      insertedThisCall: counts.inserted, skippedExisting: counts.skipped,
      rejected: [] as string[], teams: teams.length, staff: staff.length,
      credentials: credentials.length ? credentials : undefined, adminCredential: adminCredential ?? undefined, samples,
    };
  });

export const purgeDemoDataset = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { datasetId: string }) => z.object({ datasetId: z.string().trim().min(3).max(40) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    assertDemoEnabled();
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    // Refuse when genuine records reference demo rows.
    const preview = await context.supabase.rpc('preview_demo_purge', { _dataset: data.datasetId });
    if (preview.error) throw new Error(preview.error.message);
    if (((preview.data as { genuine_records_blocked?: number }).genuine_records_blocked ?? 0) > 0)
      throw new Error('Cleanup refused: genuine citizen records reference this demo dataset. Review those links first.');
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
