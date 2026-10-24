// Isolated in-memory PostgreSQL: no production connections or fixture writes.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
const db = new PGlite();
const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const issue = '33333333-3333-4333-8333-333333333333';
const event = '44444444-4444-4444-8444-444444444444';
const migration = readFileSync('drizzle/migrations/0031_recipient_notifications.sql', 'utf8');
function fn(name: string) {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  const end = migration.indexOf('$$;', migration.indexOf('AS $$', start)) + 3;
  return migration.slice(start, end);
}
async function asUser(id: string) { await db.exec(`SELECT set_config('test.user','${id}',false);`); }
async function page(state = 'all') { const r = await db.query<{ v: { unread: number; total: number; rows: { id: string }[] } }>(`select notification_page($1,'','','',0) v`, [state]); return r.rows[0]?.v; }
describe('Persisted recipient notification transactions', () => {
  beforeAll(async () => {
    await db.exec(`CREATE SCHEMA auth; CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
      CREATE TABLE staff_profiles(user_id uuid,active boolean); CREATE TABLE scope_access(user_id uuid,issue_id uuid);
      CREATE FUNCTION is_staff(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM staff_profiles WHERE user_id=$1 AND active) $$;
      CREATE FUNCTION is_supervisor(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
      CREATE FUNCTION staff_can_work(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT is_staff($1) AND EXISTS(SELECT 1 FROM scope_access WHERE user_id=$1 AND issue_id=$2) $$;
      CREATE TABLE issues(id uuid,ref_code text);
      CREATE TABLE issue_events(id uuid,issue_id uuid,actor_id uuid);
      CREATE TABLE issue_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),issue_id uuid,audience text,channel text,status text,detail text,attempts integer,recipient_user_id uuid,event_id uuid,event_key text,notification_type text,title text,priority text,actor_id uuid,created_at timestamptz DEFAULT now());
      CREATE UNIQUE INDEX notification_recipient_event ON issue_notifications(recipient_user_id,event_key) WHERE recipient_user_id IS NOT NULL;
      CREATE TABLE notification_reads(notification_id uuid,user_id uuid,read_at timestamptz,archived_at timestamptz,PRIMARY KEY(notification_id,user_id));
      INSERT INTO staff_profiles VALUES('${a}',true),('${b}',true); INSERT INTO scope_access VALUES('${a}','${issue}');
      INSERT INTO issues VALUES('${issue}','BLR-ISOLATED'); INSERT INTO issue_events VALUES('${event}','${issue}',NULL);`);
    for (const name of ['notification_access', 'set_notification_state', 'notification_page', 'emit_case_notifications']) await db.exec(fn(name));
    await db.exec(`SELECT emit_case_notifications('${event}','assignment','Assigned','Actual isolated assignment',false);`);
    await asUser(a);
  }, 30000);
  afterAll(async () => { await db.close(); });
  it('creates a notification only for authorized recipients', async () => {
    const r = await db.query<{ recipient_user_id: string }>('select recipient_user_id from issue_notifications');
    expect(r.rows.map(r => r.recipient_user_id)).toEqual([a]);
  });
  it('does not duplicate a repeated event', async () => {
    await db.exec(`SELECT emit_case_notifications('${event}','assignment','Assigned','Retry',false);`);
    expect((await page())?.total).toBe(1);
  });
  it('marks read idempotently and preserves its timestamp', async () => {
    const id = (await page())?.rows[0]?.id; expect(id).toBeDefined();
    await db.query('select set_notification_state($1,\'read\')', [id]);
    const before = await db.query('select read_at from notification_reads');
    await db.query('select set_notification_state($1,\'read\')', [id]);
    expect(await db.query('select read_at from notification_reads')).toEqual(before);
    expect((await page())?.unread).toBe(0);
  });
  it('marks unread and supports archive/restore', async () => {
    const id = (await page())?.rows[0]?.id;
    await db.query('select set_notification_state($1,\'unread\')', [id]);
    expect((await page())?.unread).toBe(1);
    await db.query('select set_notification_state($1,\'archive\')', [id]);
    expect((await page())?.total).toBe(0); expect((await page('archived'))?.total).toBe(1);
    await db.query('select set_notification_state($1,\'restore\')', [id]); expect((await page())?.unread).toBe(1);
  });
  it('rejects another recipient and limits bulk actions to the caller', async () => {
    const id = (await page())?.rows[0]?.id;
    await asUser(b); expect((await page())?.total).toBe(0);
    await expect(db.query('select set_notification_state($1,\'read\')', [id])).rejects.toThrow('Notification unavailable');
    await db.exec("select set_notification_state(NULL,'read_all')");
    await asUser(a); expect((await page())?.unread).toBe(1);
    await db.exec("select set_notification_state(NULL,'read_all')"); expect((await page())?.unread).toBe(0);
  });
  it('rechecks scope on subsequent access', async () => {
    await db.exec(`DELETE FROM scope_access WHERE user_id='${a}'`); expect((await page())?.total).toBe(0);
  });
  it('rejects suspended sessions', async () => {
    await db.exec(`UPDATE staff_profiles SET active=false WHERE user_id='${a}'`);
    await expect(page()).rejects.toThrow('Invalid notification request');
  });
});