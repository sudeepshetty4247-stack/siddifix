// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';

const db=new PGlite();
const owner='11111111-1111-4111-8111-111111111111';
const staff='22222222-2222-4222-8222-222222222222';
const team='33333333-3333-4333-8333-333333333333';
describe('Atomic service-area account provisioning',()=>{
 beforeAll(async()=>{
  await db.exec(`CREATE SCHEMA auth; CREATE TYPE app_role AS ENUM ('admin','supervisor','field_worker'); CREATE TABLE civic_coverage(id text,enabled boolean); INSERT INTO civic_coverage VALUES('anantapur',true),('bengaluru',true); CREATE TABLE civic_teams(id uuid,active boolean,coverage_id text,department text); INSERT INTO civic_teams VALUES('${team}',true,'anantapur','Demo Roads'); CREATE TABLE admin_permissions(user_id uuid,is_super_admin boolean default false,coverage_ids text[],created_by uuid); INSERT INTO admin_permissions VALUES('${owner}',true,ARRAY['bengaluru'],'${owner}'); CREATE TABLE user_roles(user_id uuid,role app_role); CREATE TABLE staff_profiles(user_id uuid,display_name text,designation text,department text,categories text[],wards text[],team_ids uuid[],corporations text[],coverage_ids text[],created_by uuid,updated_by uuid); CREATE TABLE civic_directory_audit(table_name text,record_id uuid,action text,actor_id uuid,new_row jsonb); CREATE FUNCTION account_active(uuid) RETURNS boolean LANGUAGE sql AS 'SELECT true'; CREATE FUNCTION has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT $1='${owner}'::uuid $$; CREATE FUNCTION can_manage_admins(uuid) RETURNS boolean LANGUAGE sql AS 'SELECT true'; CREATE FUNCTION validate_provisioned_staff_scope(uuid) RETURNS void LANGUAGE sql AS 'SELECT'; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;`);
  await db.exec(readFileSync('drizzle/migrations/0054_area_scoped_atomic_account_provisioning.sql','utf8'));
 },30000);
 afterAll(()=>db.close());
 const profile={fullName:'Demo staff',designation:'Demo supervisor',department:'Demo Roads',categories:['roads'],wards:[],teamIds:[team],corporations:[],coverageIds:['anantapur']};
 it('persists Anantapur scope at account creation rather than defaulting to Bengaluru',async()=>{
  await db.query('select admin_provision_account($1,$2,$3::jsonb,$4)',[staff,'supervisor',JSON.stringify(profile),owner]);
  const row=await db.query<{coverage_ids:string[]}>('select coverage_ids from staff_profiles where user_id=$1',[staff]);
  expect(row.rows[0]?.coverage_ids).toEqual(['anantapur']);
 });
 it('rejects a Bengaluru account linked to an Anantapur team atomically',async()=>{
  const other='44444444-4444-4444-8444-444444444444';
  await expect(db.query('select admin_provision_account($1,$2,$3::jsonb,$4)',[other,'supervisor',JSON.stringify({...profile,coverageIds:['bengaluru']}),owner])).rejects.toThrow('Team outside');
  const rows=await db.query('select * from user_roles where user_id=$1',[other]);expect(rows.rows).toHaveLength(0);
 });
 it('does not grant provisioning power to a regular staff account',async()=>{
  await expect(db.query('select admin_provision_account($1,$2,$3::jsonb,$4)',['55555555-5555-4555-8555-555555555555','supervisor',JSON.stringify(profile),staff])).rejects.toThrow('Super Admin');
 });
});