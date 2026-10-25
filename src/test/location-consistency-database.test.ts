// @vitest-environment node
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';

const db=new PGlite();
const sql48=readFileSync('drizzle/migrations/0048_report_integrity_and_guarded_review.sql','utf8');
const sql63=readFileSync('drizzle/migrations/0063_location_consistency_evidence.sql','utf8');
function source(name:string){const start=sql48.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);const end=sql48.indexOf('$$;',sql48.indexOf('AS $$',start))+3;if(start<0||end<3)throw new Error('Missing SQL fixture');return sql48.slice(start,end);}

let seq=0;
async function submit(locationConsistency:Record<string,unknown>|null){
  seq+=1;const key=`55555555-5555-4555-8555-${String(seq).padStart(12,'0')}`;const session='b'.repeat(64);
  await db.query("insert into report_upload_reservations(key,session_hash,expires_at,consumed) values($1,$2,now()+interval '2 hours',false)",[key,session]);
  const report={title:`Location test ${seq}`,description:'A real incident described for location consistency testing',category:'roads',status:'submitted',lat:12.97,lng:77.59,integrity_fingerprint:`${seq.toString(16).padStart(2,'0')}${'a'.repeat(62)}`,integrity_session:session,idempotency_key:key,ref_code:`BLR-LC${seq}`,...(locationConsistency?{location_consistency:locationConsistency}:{})};
  await db.query('select create_civic_report($1,$2)',[report,'a'.repeat(48)]);
  const row=(await db.query<{risk_score:number;signals:{code:string;points:number}[];location_consistency:Record<string,unknown>|null;state:string}>("select r.risk_score,r.signals,r.location_consistency,r.state from report_integrity r join issues i on i.id=r.issue_id where i.ref_code=$1",[report.ref_code])).rows[0];
  return row;
}

describe('Server-side location consistency evidence',()=>{
 beforeAll(async()=>{
  await db.exec(`CREATE SCHEMA auth;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
  CREATE TYPE issue_status AS ENUM('submitted','needs_classification','assigned','under_review','resolved','closed','rejected','reopened');
  CREATE TABLE issues(id uuid PRIMARY KEY,ref_code text,status issue_status,idempotency_key text,created_at timestamptz DEFAULT now(),demo_dataset_id text);
  CREATE TABLE report_integrity_settings(id boolean PRIMARY KEY,session_limit int,network_limit int,user_limit int,window_minutes int,challenge_after int,review_threshold int,updated_at timestamptz DEFAULT now(),updated_by uuid);
  CREATE TABLE report_abuse_windows(key text PRIMARY KEY,hits int,expires_at timestamptz);
  CREATE TABLE report_challenge_uses(nonce uuid PRIMARY KEY,expires_at timestamptz);
  CREATE TABLE report_upload_reservations(key uuid PRIMARY KEY,session_hash text,original_path text,expires_at timestamptz,consumed boolean,request_fingerprint text);
  CREATE TABLE report_integrity(issue_id uuid PRIMARY KEY,state text DEFAULT 'unverified',risk_score int,signals jsonb,request_fingerprint text,image_hash text,session_hash text,review_reason text,reviewed_by uuid,reviewed_at timestamptz,updated_at timestamptz DEFAULT now());
  CREATE TABLE report_integrity_audit(id uuid DEFAULT gen_random_uuid(),issue_id uuid,actor_id uuid,actor_label text,action text,reason text,from_state text,to_state text,from_status issue_status,to_status issue_status,created_at timestamptz DEFAULT now());
  CREATE TABLE issue_events(issue_id uuid,kind text,from_status issue_status,to_status issue_status,note text,actor_id uuid,actor_label text,visibility text DEFAULT 'public');
  CREATE FUNCTION integrity_settings() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"session_limit":10,"network_limit":60,"user_limit":15,"window_minutes":10,"challenge_after":3,"review_threshold":30}'::jsonb $$;
  CREATE FUNCTION ward_at_point(float8,float8) RETURNS TABLE(name text) LANGUAGE sql AS $$ SELECT 'supported ward' WHERE $1 BETWEEN 12 AND 14 AND $2 BETWEEN 77 AND 78 $$;
  CREATE FUNCTION nearby_issues(float8,float8,int,text) RETURNS TABLE(id uuid) LANGUAGE sql AS $$ SELECT NULL::uuid WHERE false $$;
  CREATE FUNCTION create_civic_report_core(jsonb,text) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN INSERT INTO issues(id,ref_code,status,idempotency_key) VALUES(gen_random_uuid(),$1->>'ref_code',($1->>'status')::issue_status,$1->>'idempotency_key');RETURN jsonb_build_object('ref',$1->>'ref_code','duplicate',false);END $$;`);
  await db.exec(source('create_civic_report'));
  await db.exec(sql63);
 },30000);
 afterAll(()=>db.close());

 it('stores mismatch evidence and adds a review signal',async()=>{
  const row=await submit({status:'mismatch',distanceM:185000,toleranceM:150,evidenceSource:'embedded',userConfirmed:false});
  expect(row.location_consistency).toMatchObject({status:'mismatch',distanceM:185000});
  expect(row.signals.some(s=>s.code==='location_mismatch'&&s.points===20)).toBe(true);
 });
 it('records a reporter-confirmed mismatch with a lower score',async()=>{
  const row=await submit({status:'mismatch',distanceM:4200,toleranceM:150,evidenceSource:'device-session',userConfirmed:true});
  expect(row.signals.some(s=>s.code==='location_mismatch_confirmed'&&s.points===10)).toBe(true);
  expect(row.signals.some(s=>s.code==='location_mismatch')).toBe(false);
  expect(row.location_consistency).toMatchObject({userConfirmed:true});
 });
 it('flags imprecise evidence as location_uncertain',async()=>{
  const row=await submit({status:'needs_review',distanceM:30000,toleranceM:4000,evidenceSource:'device-session',userConfirmed:false});
  expect(row.signals.some(s=>s.code==='location_uncertain'&&s.points===10)).toBe(true);
 });
 it('stores consistent evidence without any location signal',async()=>{
  const row=await submit({status:'consistent',distanceM:42,toleranceM:150,evidenceSource:'device-session',userConfirmed:false});
  expect(row.location_consistency).toMatchObject({status:'consistent'});
  expect(row.signals.some(s=>s.code.startsWith('location_'))).toBe(false);
 });
 it('leaves text-only reports without location evidence untouched',async()=>{
  const row=await submit(null);
  expect(row.location_consistency).toBeNull();
  expect(row.signals.some(s=>s.code.startsWith('location_'))).toBe(false);
 });
});
