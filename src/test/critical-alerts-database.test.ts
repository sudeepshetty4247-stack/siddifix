// @vitest-environment node
// Runs migration-defined critical-incident and surge triggers in isolated PostgreSQL.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
const db = new PGlite();
const staff = '11111111-1111-4111-8111-111111111111';
function source(name: string) {
  const s = readFileSync('drizzle/migrations/0042_critical_incident_alerts.sql', 'utf8');
  const start = s.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  const end = s.indexOf('$$;', s.indexOf('AS $$', start) + 5) + 3;
  return s.slice(start, end);
}
const count = async (type: string, issue: string) =>
  (await db.query<{ n: number }>(`select count(*)::int n from issue_notifications where notification_type=$1 and issue_id=$2`, [type, issue])).rows[0]!.n;
describe('Critical incident and surge alerts', () => {
  beforeAll(async () => {
    await db.exec(`CREATE TYPE issue_severity AS ENUM('low','medium','high','critical');
      CREATE TABLE issues(id uuid PRIMARY KEY,ref_code text,title text,category text,landmark text,severity issue_severity,duplicate_of uuid,acknowledged_at timestamptz,ack_due_at timestamptz,support_count int DEFAULT 0);
      CREATE TABLE issue_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),issue_id uuid,kind text,note text,actor_id uuid,actor_label text,visibility text DEFAULT 'public',event_key text);
      CREATE TABLE staff_profiles(user_id uuid PRIMARY KEY);
      CREATE TABLE issue_notifications(id uuid DEFAULT gen_random_uuid(),issue_id uuid,audience text,channel text,status text,detail text,attempts int,recipient_user_id uuid,event_id uuid,event_key text,notification_type text,title text,priority text,actor_id uuid);
      CREATE UNIQUE INDEX nre ON issue_notifications(recipient_user_id,event_key) WHERE recipient_user_id IS NOT NULL;
      CREATE FUNCTION staff_can_work(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
      CREATE FUNCTION is_supervisor(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
      INSERT INTO staff_profiles VALUES('${staff}');
      INSERT INTO issues(id,ref_code,title,category,severity) VALUES
        ('a0000000-0000-4000-8000-000000000001','BLR-CRIT','Open manhole','drainage','critical'),
        ('a0000000-0000-4000-8000-000000000002','BLR-LOW','Faded paint','roads','low');`);
    for (const f of ['emit_case_notifications', 'critical_incident_watch', 'report_surge_watch']) await db.exec(source(f));
    await db.exec(`CREATE TRIGGER c AFTER INSERT ON issue_events FOR EACH ROW EXECUTE FUNCTION critical_incident_watch();
      CREATE TRIGGER s AFTER UPDATE OF support_count ON issues FOR EACH ROW EXECUTE FUNCTION report_surge_watch();`);
  });
  afterAll(async () => db.close());
  it('a single critical report alerts staff immediately with critical priority', async () => {
    await db.exec(`insert into issue_events(issue_id,kind) values('a0000000-0000-4000-8000-000000000001','created')`);
    expect(await count('critical_incident', 'a0000000-0000-4000-8000-000000000001')).toBe(1);
    const p = await db.query<{ priority: string }>(`select priority from issue_notifications where notification_type='critical_incident'`);
    expect(p.rows[0]!.priority).toBe('critical');
  });
  it('a low-severity report does not raise a critical alert', async () => {
    await db.exec(`insert into issue_events(issue_id,kind) values('a0000000-0000-4000-8000-000000000002','created')`);
    expect(await count('critical_incident', 'a0000000-0000-4000-8000-000000000002')).toBe(0);
  });
  it('reopening a critical case raises a fresh alert', async () => {
    await db.exec(`insert into issue_events(issue_id,kind) values('a0000000-0000-4000-8000-000000000001','disputed')`);
    expect(await count('critical_incident', 'a0000000-0000-4000-8000-000000000001')).toBe(2);
  });
  it('alerts once when linked reports reach 3, never repeating for the same threshold', async () => {
    const id = 'a0000000-0000-4000-8000-000000000002';
    await db.exec(`update issues set support_count=2 where id='${id}'`);
    expect(await count('surge_detected', id)).toBe(0);
    await db.exec(`update issues set support_count=3 where id='${id}'`);
    await db.exec(`update issues set support_count=4 where id='${id}'`);
    expect(await count('surge_detected', id)).toBe(1);
  });
  it('report volume alone does not change severity', async () => {
    const r = await db.query<{ severity: string }>(`select severity from issues where ref_code='BLR-LOW'`);
    expect(r.rows[0]!.severity).toBe('low');
  });
});
