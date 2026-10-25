// @vitest-environment node
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
const db=new PGlite();const sql=readFileSync('drizzle/migrations/0055_exclusive_admin_area_permission_checks.sql','utf8');
function source(name:string){const start=sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);const end=sql.indexOf('$$;',start)+3;if(start<0||end<3)throw new Error('Missing fixture');return sql.slice(start,end);}
const staff='11111111-1111-4111-8111-111111111111',admin='22222222-2222-4222-8222-222222222222',owner='33333333-3333-4333-8333-333333333333';
describe('Database service-area authorization',()=>{
 beforeAll(async()=>{await db.exec(`CREATE TABLE staff_profiles(user_id uuid,active boolean,coverage_ids text[]);CREATE TABLE admin_permissions(user_id uuid,is_super_admin boolean,coverage_ids text[]);CREATE FUNCTION account_active(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $1<>'44444444-4444-4444-8444-444444444444'::uuid $$;CREATE FUNCTION has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT $1 IN ('${admin}'::uuid,'${owner}'::uuid) AND $2='admin' $$;INSERT INTO staff_profiles VALUES('${staff}',true,ARRAY['anantapur']);INSERT INTO admin_permissions VALUES('${admin}',false,ARRAY['anantapur']),('${owner}',true,ARRAY['bengaluru']);`);await db.exec(source('can_access_service_area'));},30000);
 afterAll(()=>db.close());
 it('allows assigned Anantapur staff access',async()=>{const r=await db.query<{allowed:boolean}>('select can_access_service_area($1,$2) allowed',[staff,'anantapur']);expect(r.rows[0]?.allowed).toBe(true);});
 it('rejects cross-district staff access to Bengaluru',async()=>{const r=await db.query<{allowed:boolean}>('select can_access_service_area($1,$2) allowed',[staff,'bengaluru']);expect(r.rows[0]?.allowed).toBe(false);});
 it('rejects district admin access to another area',async()=>{const r=await db.query<{allowed:boolean}>('select can_access_service_area($1,$2) allowed',[admin,'bengaluru']);expect(r.rows[0]?.allowed).toBe(false);});
 it('allows explicit Super Admin cross-area administration',async()=>{const r=await db.query<{allowed:boolean}>('select can_access_service_area($1,$2) allowed',[owner,'anantapur']);expect(r.rows[0]?.allowed).toBe(true);});
 it('does not authorize unknown report locations',async()=>{const r=await db.query<{allowed:boolean}>('select can_access_service_area($1,NULL) allowed',[owner]);expect(r.rows[0]?.allowed).toBe(false);});
 it('does not authorize an unconfigured account',async()=>{const r=await db.query<{allowed:boolean}>('select can_access_service_area($1,$2) allowed',['55555555-5555-4555-8555-555555555555','anantapur']);expect(r.rows[0]?.allowed).toBe(false);});
 it('never broadens district admin permission using an unrelated staff profile',async()=>{await db.exec(`INSERT INTO staff_profiles VALUES('${admin}',true,ARRAY['bengaluru']);`);const r=await db.query<{allowed:boolean}>('select can_access_service_area($1,$2) allowed',[admin,'bengaluru']);expect(r.rows[0]?.allowed).toBe(false);});
});