// @vitest-environment node
// Runs migration-defined workflow functions in isolated PostgreSQL; provider auth/storage are fixtures, not live services.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
const db = new PGlite();
const worker = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const caseId = '33333333-3333-4333-8333-333333333333';
function source(file: string, name: string) {
  const s = readFileSync(`drizzle/migrations/${file}.sql`, 'utf8');
  const start = s.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  const body = s.indexOf('AS $$', start);
  const end = s.indexOf('$$;', body + 5) + 3;
  if (start < 0 || body < 0 || end < 3) throw new Error(`Function fixture not found: ${name}`);
  return s.slice(start, end);
}
async function user(id: string) { await db.query("select set_config('test.user',$1,false)", [id]); }
describe('Isolated staff-to-citizen persisted pipeline', () => {
  beforeAll(async () => {
    await db.exec(`CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
      CREATE TYPE issue_status AS ENUM('needs_classification','submitted','under_review','assigned','accepted','inspection_scheduled','in_progress','awaiting_verification','resolved','rejected','reopened','closed');
      CREATE TABLE staff_profiles(user_id uuid PRIMARY KEY,active boolean);
      CREATE FUNCTION is_staff(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM staff_profiles WHERE user_id=$1 AND active) $$;
      CREATE FUNCTION is_supervisor(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
      CREATE FUNCTION staff_actor_label(uuid) RETURNS text LANGUAGE sql AS $$ SELECT 'Isolated worker'::text $$;
      CREATE TABLE issues(id uuid PRIMARY KEY,ref_code text,status issue_status,category text,duplicate_of uuid,acknowledged_at timestamptz,acknowledged_by uuid,ack_message text,eta_at timestamptz,inspection_at timestamptz,ack_due_at timestamptz,sla_due_at timestamptz,resolved_at timestamptz,assignment_state text DEFAULT 'assigned',team_id uuid,assigned_to uuid,severity text,created_at timestamptz DEFAULT now());
      CREATE FUNCTION staff_can_work(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT is_staff($1) AND $1='${worker}'::uuid AND $2='${caseId}'::uuid $$;
      CREATE TABLE issue_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),issue_id uuid,kind text,from_status issue_status,to_status issue_status,note text,actor_id uuid,actor_label text,created_at timestamptz DEFAULT now(),visibility text DEFAULT 'public',request_key uuid,event_key text);
      CREATE UNIQUE INDEX message_retry ON issue_events(actor_id,request_key) WHERE request_key IS NOT NULL;
      CREATE TABLE issue_evidence(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),issue_id uuid,kind text,storage_path text,note text,actor_id uuid,request_key uuid);
      CREATE TABLE storage.objects(bucket_id text,name text);
      CREATE TABLE staff_response_templates(id uuid,name text,body text,statuses text[],active boolean);
      CREATE TABLE issue_notifications(id uuid DEFAULT gen_random_uuid(),issue_id uuid,audience text,channel text,status text,detail text,attempts integer,recipient_user_id uuid,event_id uuid,event_key text,notification_type text,title text,priority text,actor_id uuid,created_at timestamptz DEFAULT now());
      CREATE UNIQUE INDEX notification_recipient_event ON issue_notifications(recipient_user_id,event_key) WHERE recipient_user_id IS NOT NULL;
      INSERT INTO staff_profiles VALUES('${worker}',true),('${other}',true);
      INSERT INTO issues(id,ref_code,status,category) VALUES('${caseId}','BLR-ISOLATED','assigned','roads');
      CREATE FUNCTION verify_reporter_token(text,text) RETURNS boolean LANGUAGE sql AS $$ SELECT $1='BLR-ISOLATED' AND $2='isolated-capability' $$;`);
    await db.exec(source('0031_recipient_notifications', 'emit_case_notifications'));
    await db.exec(source('0031_recipient_notifications', 'record_issue_notification'));
    await db.exec('CREATE TRIGGER notify AFTER INSERT ON issue_events FOR EACH ROW EXECUTE FUNCTION record_issue_notification();');
    await db.exec(source('0015_staff_acknowledgement_workflow', 'staff_acknowledge_issue'));
    let change = source('0015_staff_acknowledgement_workflow', 'staff_change_issue');
    change = change.replace(' sup := public.is_supervisor(auth.uid());', " IF _next='closed' THEN RAISE EXCEPTION 'Only the original reporter can confirm and close a resolved case'; END IF; sup := public.is_supervisor(auth.uid());");
    await db.exec(change);
    await db.exec(source('0032_staff_communication_and_reminders', 'staff_case_message'));
    let publicEvents = source('0015_staff_acknowledgement_workflow', 'public_case_events');
    publicEvents = publicEvents.replace("WHEN kind='status_change'", "WHEN kind IN ('status_change','public_update')").replace('WHERE issue_id=_id', "WHERE issue_id=_id AND visibility='public'");
    await db.exec(publicEvents);
    await db.exec(source('0010_secure_report_media_and_public_projections', 'citizen_change_issue'));
    let prerequisite = source('0007_report_candidates_and_completion_evidence', 'require_completion_evidence');
    prerequisite = prerequisite.replace("kind='completion'", "kind='completion' AND EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='issue-photos' AND o.name=issue_evidence.storage_path)");
    await db.exec(prerequisite);
    await db.exec('CREATE TRIGGER completion BEFORE UPDATE ON issues FOR EACH ROW EXECUTE FUNCTION require_completion_evidence();');
    await user(worker);
  }, 30000);
  afterAll(async () => db.close());
  it('persists acknowledgement once and projects it to the citizen', async () => {
    await db.query('select staff_acknowledge_issue($1,\'assigned\',\'Received for inspection\',NULL,NULL)', [caseId]);
    const r = await db.query<{ status: string; acknowledged_at: string }>('select status,acknowledged_at from issues');
    expect(r.rows[0]?.status).toBe('accepted'); expect(r.rows[0]?.acknowledged_at).toBeTruthy();
    const events = await db.query<{ v: { kind: string; note: string }[] }>('select public_case_events($1) v', [caseId]);
    expect(events.rows[0]?.v[0]?.note).toBe('Received for inspection');
    await expect(db.query('select staff_acknowledge_issue($1,\'assigned\',\'Received for inspection\',NULL,NULL)', [caseId])).rejects.toThrow('changed');
    expect((await db.query<{ n: number }>("select count(*)::int n from issue_events where kind='acknowledged'")).rows[0]?.n).toBe(1);
  });
  it('publishes progress but never internal notes', async () => {
    await db.query('select staff_case_message($1,\'Work started at site\',\'public\',$2)', [caseId, '55555555-5555-4555-8555-555555555555']);
    await db.query('select staff_case_message($1,\'Private dependency detail\',\'internal\',$2)', [caseId, '66666666-6666-4666-8666-666666666666']);
    const r = await db.query<{ v: { note: string }[] }>('select public_case_events($1) v', [caseId]);
    expect(r.rows[0]?.v.map(e => e.note)).toContain('Work started at site');
    expect(r.rows[0]?.v.map(e => e.note)).not.toContain('Private dependency detail');
  });
  it('rejects unauthorized category/scope progress', async () => {
    await user(other);
    await expect(db.query('select staff_change_issue($1,\'accepted\',\'in_progress\',\'Started\')', [caseId])).rejects.toThrow('outside');
    await user(worker);
  });
  it('rejects stale concurrent updates and missing completion evidence', async () => {
    await db.query('select staff_change_issue($1,\'accepted\',\'in_progress\',\'Work started\')', [caseId]);
    await expect(db.query('select staff_change_issue($1,\'accepted\',\'in_progress\',\'Other update\')', [caseId])).rejects.toThrow('changed');
    await expect(db.query('select staff_change_issue($1,\'in_progress\',\'resolved\',\'Repair completed\')', [caseId])).rejects.toThrow('completion');
  });
  it('does not resolve merely because evidence exists and requires stored object', async () => {
    await db.query('insert into issue_evidence(issue_id,kind,storage_path) values($1,\'completion\',\'isolated/completion.jpg\')', [caseId]);
    expect((await db.query<{ status: string }>('select status from issues')).rows[0]?.status).toBe('in_progress');
    await expect(db.query('select staff_change_issue($1,\'in_progress\',\'resolved\',\'Repair completed\')', [caseId])).rejects.toThrow('completion');
    await db.exec("INSERT INTO storage.objects VALUES('issue-photos','isolated/completion.jpg')");
    await db.query('select staff_change_issue($1,\'in_progress\',\'resolved\',\'Repair completed\')', [caseId]);
    expect((await db.query<{ status: string }>('select status from issues')).rows[0]?.status).toBe('resolved');
  });
  it('only a valid reporter capability confirms closure', async () => {
    await expect(db.query('select staff_change_issue($1,\'resolved\',\'closed\',\'Close\')', [caseId])).rejects.toThrow('original reporter');
    await expect(db.query("select citizen_change_issue('BLR-ISOLATED','wrong','confirm','')")).rejects.toThrow('not valid');
    await db.exec("select citizen_change_issue('BLR-ISOLATED','isolated-capability','reopen','')");
    expect((await db.query<{ status: string }>('select status from issues')).rows[0]?.status).toBe('reopened');
    await db.exec("UPDATE issues SET status='resolved'");
    await db.exec("select citizen_change_issue('BLR-ISOLATED','isolated-capability','confirm','')");
    expect((await db.query<{ status: string }>('select status from issues')).rows[0]?.status).toBe('closed');
    const notifications = await db.query<{ notification_type: string }>('select notification_type from issue_notifications where recipient_user_id=$1', [worker]);
    expect(notifications.rows.map(n => n.notification_type)).toContain('resolution_confirmed');
    expect(notifications.rows.map(n => n.notification_type)).toContain('case_reopened');
  });
});