// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll,afterAll,describe,it,expect } from 'vitest';
const db=new PGlite();
describe('Full-dataset filtered aggregate permissions and counting',()=>{
 beforeAll(async()=>{await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE TABLE civic_wards(identifier text,name text,corporation text,coverage_id text);
 CREATE TABLE issue_events(issue_id uuid,kind text);
 CREATE TABLE issues(id uuid default gen_random_uuid(),created_at timestamptz,status text,severity text,category text,routing_snapshot jsonb,duplicate_of uuid,eta_at timestamptz,sla_due_at timestamptz,resolved_at timestamptz,escalated_at timestamptz,acknowledged_at timestamptz,team_id uuid,assignment_state text);
 INSERT INTO civic_wards VALUES('verified-ward','Verified ward','Configured corporation','city');
 INSERT INTO issues(created_at,status,severity,category,routing_snapshot,assignment_state) VALUES('2026-10-23T18:40:00Z','submitted','high','roads','{"ward":{"identifier":"verified-ward"},"coverage":{"id":"city"}}','exception'),('2026-10-23T12:00:00Z','closed','low','water','{}','assigned');
 INSERT INTO issues(created_at,status,severity,category,routing_snapshot,duplicate_of) SELECT '2026-10-23T12:00:00Z','submitted','high','roads','{}',id FROM issues WHERE category='water';
 INSERT INTO issue_events SELECT id,'citizen_confirmed' FROM issues WHERE status='closed';`);await db.exec(readFileSync('drizzle/migrations/0038_filtered_public_report_snapshot.sql','utf8'));},30000);
 afterAll(async()=>{await db.close();});
 async function snapshot(filters:Record<string,string>={}){return (await db.query<{r:{summary:Record<string,number>;trend:{period:string;reports:number}[]}}>('select public_report_snapshot($1::jsonb) r',[JSON.stringify(filters)])).rows[0]?.r;}
 it('counts stable records not events and excludes linked duplicates by default',async()=>{await db.exec("INSERT INTO issue_events SELECT id,'status' FROM issues");const r=await snapshot();expect(r?.summary['total']).toBe(2);expect(r?.summary['citizen_confirmed']).toBe(1);expect(r?.summary['active']).toBe(1);});
 it('separates actual duplicate submissions',async()=>{expect((await snapshot({records:'all'}))?.summary['total']).toBe(3);expect((await snapshot({records:'linked'}))?.summary['total']).toBe(1);});
 it('applies category severity jurisdiction and date filters to the full dataset',async()=>{expect((await snapshot({category:'roads',severity:'high',corporation:'Configured corporation'}))?.summary['total']).toBe(1);expect((await snapshot({category:'water',severity:'high'}))?.summary['total']).toBe(0);expect((await snapshot({start:'2026-10-24T00:00:00+05:30',end:'2026-10-25T00:00:00+05:30'}))?.summary['total']).toBe(1);});
 it('uses IST day grouping and null durations when unmeasured',async()=>{const r=await snapshot({category:'roads'});expect(r?.trend[0]?.period).toBe('2026-10-24');expect(r?.summary['average_response_hours']).toBeNull();});
 it('exposes aggregates to anon but not base report rows',async()=>{await db.exec('SET ROLE anon');try{expect((await snapshot())?.summary['total']).toBe(2);await expect(db.query('select * from issues')).rejects.toThrow(/permission denied/);}finally{await db.exec('RESET ROLE');}});
});