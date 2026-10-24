// @vitest-environment node
// Disposable in-memory SQL only; never connects to the shared application database.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
const db = new PGlite();
const categories = ['roads','electricity','water','drainage','waste','transport','parks','sanitation','trees','buildings','other'];
const worker='11111111-1111-4111-8111-111111111111';
const outsider='22222222-2222-4222-8222-222222222222';
function sqlFunction(file:string,name:string) {
  const sql=readFileSync(`drizzle/migrations/${file}.sql`,'utf8');
  const start=sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  const body=sql.indexOf('AS $$',start);
  const end=sql.indexOf('$$;',body+5)+3;
  if(start<0||body<0||end<3)throw new Error(`Missing SQL function ${name}`);
  return sql.slice(start,end);
}
async function report(category:string,department:string|null='Isolated department',status='submitted') {
  const result=await db.query<{id:string}>(`INSERT INTO issues(category,department,status,routing_snapshot) VALUES($1,$2,$3,'{"ward":{"identifier":"isolated-ward"}}') RETURNING id`,[category,department,status]);
  const id=result.rows[0]?.id;if(!id)throw new Error('Fixture missing');return id;
}
describe('Department routing connects case events to scoped recipient notifications',()=>{
  beforeAll(async()=>{
    await db.exec(`CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${worker}'::uuid $$;
      CREATE TABLE staff_profiles(user_id uuid,active boolean);
      CREATE FUNCTION is_staff(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM staff_profiles WHERE user_id=$1 AND active) $$;
      CREATE FUNCTION is_supervisor(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
      CREATE TABLE civic_teams(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,department text,categories text[],wards text[],active boolean,is_fallback boolean);
      CREATE TABLE issues(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),category text,department text,status text,team_id uuid,assignment_state text,routing_snapshot jsonb,updated_at timestamptz,acknowledged_at timestamptz,ack_due_at timestamptz);
      CREATE FUNCTION staff_can_work(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT is_staff($1) AND $1='${worker}'::uuid AND EXISTS(SELECT 1 FROM issues i JOIN civic_teams t ON t.id=i.team_id WHERE i.id=$2 AND t.department='Isolated department') $$;
      CREATE TABLE issue_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),issue_id uuid,kind text,note text,actor_label text,actor_id uuid,to_status text,visibility text DEFAULT 'public');
      CREATE TABLE issue_notifications(id uuid DEFAULT gen_random_uuid(),issue_id uuid,audience text,channel text,status text,detail text,attempts int,recipient_user_id uuid,event_id uuid,event_key text,notification_type text,title text,priority text,actor_id uuid,created_at timestamptz DEFAULT now());
      CREATE UNIQUE INDEX notification_recipient_event ON issue_notifications(recipient_user_id,event_key) WHERE recipient_user_id IS NOT NULL;
      INSERT INTO staff_profiles VALUES('${worker}',true),('${outsider}',true);`);
    await db.exec(sqlFunction('0031_recipient_notifications','emit_case_notifications'));
    await db.exec(sqlFunction('0031_recipient_notifications','record_issue_notification'));
    await db.exec(sqlFunction('0037_route_unknown_ownership_to_configured_team','route_issue_to_team'));
    await db.exec('CREATE TRIGGER notify AFTER INSERT ON issue_events FOR EACH ROW EXECUTE FUNCTION record_issue_notification();');
  },30000);
  afterAll(async()=>{await db.exec('TRUNCATE issue_notifications,issue_events,issues,civic_teams,staff_profiles');await db.close();});
  it.each(categories)('routes %s to its unique configured team and persists one recipient notification',async(category)=>{
    const t=await db.query<{id:string}>(`INSERT INTO civic_teams(name,department,categories,wards,active,is_fallback) VALUES($1,'Isolated department',ARRAY[$2],ARRAY['isolated-ward'],true,false) RETURNING id`,[`Isolated ${category}`,category]);
    const id=await report(category);
    expect((await db.query<{v:string}>('select route_issue_to_team($1) v',[id])).rows[0]?.v).toBe('assigned');
    const row=(await db.query<{team_id:string;acknowledged:boolean}>('select team_id,status=\'accepted\' acknowledged from issues where id=$1',[id])).rows[0];
    expect(row?.team_id).toBe(t.rows[0]?.id);expect(row?.acknowledged).toBe(false);
    const notices=await db.query<{recipient_user_id:string}>('select recipient_user_id from issue_notifications where issue_id=$1 and recipient_user_id is not null',[id]);
    expect(notices.rows.map(n=>n.recipient_user_id)).toEqual([worker]);
    expect((await db.query<{v:string}>('select route_issue_to_team($1) v',[id])).rows[0]?.v).toBe('already_routed');
    expect((await db.query<{n:number}>('select count(*)::int n from issue_events where issue_id=$1',[id])).rows[0]?.n).toBe(1);
  });
  it('leaves unknown departments in review instead of guessing',async()=>{
    const id=await report('roads','Unconfigured department');
    expect((await db.query<{v:string}>('select route_issue_to_team($1) v',[id])).rows[0]?.v).toBe('exception');
    expect((await db.query<{team_id:string|null}>('select team_id from issues where id=$1',[id])).rows[0]?.team_id).toBeNull();
  });
  it('treats the ownership-review label as unknown, not a configured department',async()=>{
    const id=await report('water','Ownership review pending');
    expect((await db.query<{v:string}>('select route_issue_to_team($1) v',[id])).rows[0]?.v).toBe('assigned');
  });
  it('does not assign ambiguous matching teams',async()=>{
    await db.exec("INSERT INTO civic_teams(name,department,categories,wards,active,is_fallback) VALUES('Second roads','Isolated department',ARRAY['roads'],ARRAY['isolated-ward'],true,false)");
    const id=await report('roads');
    expect((await db.query<{v:string}>('select route_issue_to_team($1) v',[id])).rows[0]?.v).toBe('exception');
  });
  it('retains unclassified reports for human classification',async()=>{
    const id=await report('water','Isolated department','needs_classification');
    expect((await db.query<{v:string}>('select route_issue_to_team($1) v',[id])).rows[0]?.v).toBe('exception');
  });
});