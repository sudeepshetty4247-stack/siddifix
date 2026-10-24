// @vitest-environment node
// Runs the migration-defined demo purge, demo exclusion and master-data validation
// functions in isolated PostgreSQL.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';

const db = new PGlite();
const sql = readFileSync('drizzle/migrations/0043_demo_tagging_and_master_data_validation.sql', 'utf8');
function source(name: string) {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  const end = sql.indexOf('$function$;', sql.indexOf('AS $function$', start)) + 11;
  return sql.slice(start, end);
}

describe('Demo tagging, purge and master-data validation', () => {
  beforeAll(async () => {
    await db.exec(`
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
      CREATE FUNCTION public.has_role(_user_id uuid, _role text) RETURNS boolean LANGUAGE sql AS 'SELECT true';
      CREATE TABLE issues(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ref_code text, status text, duplicate_of uuid, duplicate_candidate_id uuid, team_id uuid, routing_snapshot jsonb, demo_dataset_id text);
      CREATE TABLE issue_feedback(issue_id uuid);
      CREATE TABLE issue_evidence(issue_id uuid);
      CREATE TABLE issue_notifications(issue_id uuid);
      CREATE TABLE issue_photos(issue_id uuid);
      CREATE TABLE issue_events(issue_id uuid);
      CREATE TABLE issue_assignments(issue_id uuid);
      CREATE TABLE issue_duplicate_reviews(report_id uuid, candidate_id uuid);
      CREATE TABLE issue_ownership_reviews(issue_id uuid);
      CREATE TABLE issue_secrets(issue_id uuid, demo_dataset_id text);
      CREATE TABLE staff_profiles(user_id uuid, active boolean, categories text[], department text, team_ids uuid[], demo_dataset_id text);
      CREATE TABLE civic_teams(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), active boolean, categories text[], supervisor_id uuid, demo_dataset_id text);
      CREATE TABLE civic_department_routes(category text, active boolean);
      CREATE TABLE civic_wards(identifier text, active boolean, verification_status text, coverage_id text);
      CREATE TABLE service_targets(category text, severity text, ack_hours int, resolve_hours int, reminder_hours int, active boolean);
      CREATE TABLE user_roles(user_id uuid, role text);
      CREATE TABLE civic_coverage(id text, enabled boolean);
    `);
    await db.exec(source('ward_case_counts'));
    await db.exec(source('purge_demo_dataset'));
    await db.exec(source('admin_validate_master_data'));
  });
  afterAll(async () => db.close());

  it('ward counts exclude demo-labelled reports', async () => {
    await db.query(`INSERT INTO issues(ref_code,status,routing_snapshot,demo_dataset_id) VALUES
      ('REAL-1','submitted','{"ward":{"identifier":"W1"}}',NULL),
      ('DEMO-1','submitted','{"ward":{"identifier":"W1"}}','demo-v1'),
      ('DEMO-2','resolved','{"ward":{"identifier":"W1"}}','demo-v1')`);
    const r = await db.query<{ reports: number; resolved: number }>(`SELECT * FROM ward_case_counts() WHERE ward_identifier='W1'`);
    expect(r.rows[0]!.reports).toBe(1);
    expect(r.rows[0]!.resolved).toBe(0);
  });

  it('purge removes only the labelled dataset and never genuine records', async () => {
    const demo = await db.query<{ id: string }>(`SELECT id FROM issues WHERE ref_code='DEMO-1'`);
    const demoId = demo.rows[0]!.id;
    await db.query(`INSERT INTO issue_events VALUES ('${demoId}')`);
    await db.query(`INSERT INTO issue_secrets VALUES ('${demoId}','demo-v1')`);
    await db.query(`INSERT INTO issue_feedback VALUES ('${demoId}')`);
    const r = await db.query<{ r: { issues: number; secrets: number } }>(`SELECT purge_demo_dataset('demo-v1') AS r`);
    expect(r.rows[0]!.r.issues).toBe(2);
    expect(r.rows[0]!.r.secrets).toBe(1);
    const left = await db.query<{ n: number }>(`SELECT count(*)::int n FROM issues`);
    expect(left.rows[0]!.n).toBe(1);
    const refs = await db.query<{ ref_code: string }>(`SELECT ref_code FROM issues`);
    expect(refs.rows[0]!.ref_code).toBe('REAL-1');
  });

  it('purge rejects a blank dataset id', async () => {
    await expect(db.query(`SELECT purge_demo_dataset('')`)).rejects.toThrow();
  });

  it('validation reports configuration problems with counts', async () => {
    await db.query(`INSERT INTO civic_department_routes VALUES ('roads', true)`);
    await db.query(`INSERT INTO civic_wards VALUES ('W1', true, 'unverified', 'blr')`);
    await db.query(`INSERT INTO civic_coverage VALUES ('blr', true)`);
    await db.query(`INSERT INTO service_targets VALUES ('roads','medium',48,168,12,true),('roads','medium',24,96,6,true)`);
    const r = await db.query<{ checks: { check: string; severity: string; count: number }[] }>(`SELECT admin_validate_master_data()->'checks' AS checks`);
    const checks = r.rows[0]!.checks;
    const byName = Object.fromEntries(checks.map(c => [c.check, c]));
    expect(byName['routed_categories_without_team']!.severity).toBe('error');
    expect(byName['routed_categories_without_team']!.count).toBe(1);
    expect(byName['wards_not_verified']!.count).toBe(1);
    expect(byName['conflicting_service_targets']!.severity).toBe('error');
    expect(byName['conflicting_service_targets']!.count).toBe(1);
    expect(byName['coverage_without_wards']!.severity).toBe('ok');
  });

  it('validation is rejected for non-admins', async () => {
    await db.exec(`CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text) RETURNS boolean LANGUAGE sql AS 'SELECT false'`);
    await expect(db.query(`SELECT admin_validate_master_data()`)).rejects.toThrow('Administrator access required');
    await expect(db.query(`SELECT purge_demo_dataset('demo-v1')`)).rejects.toThrow('Administrator access required');
  });
});
