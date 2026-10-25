// @vitest-environment node
// Verifies the showcase-visibility migration: demonstration rows reach public
// aggregates only when the caller explicitly opts in, and the ward snapshot
// exposes representative names without private fields.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, it, expect } from 'vitest';

const db = new PGlite();
const sql = readFileSync('drizzle/migrations/0047_showcase_visibility_and_ward_snapshot.sql', 'utf8');
function source(name: string) {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  const end = sql.indexOf('$function$;', sql.indexOf('AS $function$', start)) + 11;
  return sql.slice(start, end);
}

describe('Showcase visibility opt-in', () => {
  beforeAll(async () => {
    await db.exec(`
      CREATE TABLE issues(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ref_code text, title text, summary text, description text, category text, subcategory text, severity text, status text, safety_warning text, lat double precision, lng double precision, landmark text, photo_url text, department text, support_count int, sla_due_at timestamptz, resolved_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz, duplicate_of uuid, duplicate_candidate_id uuid, routing_snapshot jsonb, acknowledged_at timestamptz, ack_message text, eta_at timestamptz, inspection_at timestamptz, acknowledged_by uuid, demo_dataset_id text);
      CREATE TABLE civic_wards(identifier text PRIMARY KEY, name text, ward_number int, zone text, corporation text, assembly text, mla text, lok_sabha text, mp text, representative text, representative_status text, active boolean DEFAULT true);
      CREATE FUNCTION public.staff_actor_label(_user_id uuid) RETURNS text LANGUAGE sql AS 'SELECT NULL::text';
      INSERT INTO civic_wards(identifier, name, ward_number, zone, corporation, assembly, mla, lok_sabha, mp) VALUES
        ('west-19', 'Shivanapalya', 19, 'Rajarajeshwarinagar', 'Bengaluru West City Corporation', 'Yeshwanthapura', 'S. T. Somashekar', 'Bangalore North', 'Shobha Karandlaje');
      INSERT INTO issues(ref_code, title, category, severity, status, lat, lng, routing_snapshot, demo_dataset_id) VALUES
        ('REAL-1', 'Genuine report', 'roads', 'high', 'submitted', 12.97, 77.59, '{"ward":{"identifier":"west-19"}}', NULL),
        ('DEMO-1', 'Showcase report', 'roads', 'high', 'submitted', 12.97, 77.59, '{"ward":{"identifier":"west-19"}}', 'demo-v1');
    `);
    await db.exec(source('public_case_rows'));
    await db.exec(source('nearby_case_summary'));
    await db.exec(source('ward_case_counts'));
    await db.exec(source('public_ward_snapshot'));
  });

  it('public case list hides demonstration rows by default', async () => {
    const r = await db.query<{ rows: unknown }>(`SELECT public_case_rows(NULL, false) AS rows`);
    expect(JSON.stringify(r.rows[0]!.rows)).toContain('REAL-1');
    expect(JSON.stringify(r.rows[0]!.rows)).not.toContain('DEMO-1');
  });

  it('public case list includes demonstration rows only when requested', async () => {
    const r = await db.query<{ rows: unknown }>(`SELECT public_case_rows(NULL, true) AS rows`);
    expect(JSON.stringify(r.rows[0]!.rows)).toContain('DEMO-1');
  });

  it('nearby summary counts demonstration rows only when requested', async () => {
    const off = await db.query<{ s: { total: number } }>(`SELECT nearby_case_summary(12.97, 77.59, 2000, false) AS s`);
    const on = await db.query<{ s: { total: number } }>(`SELECT nearby_case_summary(12.97, 77.59, 2000, true) AS s`);
    expect(off.rows[0]!.s.total).toBe(1);
    expect(on.rows[0]!.s.total).toBe(2);
  });

  it('ward counts include demonstration rows only when requested', async () => {
    const off = await db.query<{ reports: number }>(`SELECT reports FROM ward_case_counts(false)`);
    const on = await db.query<{ reports: number }>(`SELECT reports FROM ward_case_counts(true)`);
    expect(Number(off.rows[0]!.reports)).toBe(1);
    expect(Number(on.rows[0]!.reports)).toBe(2);
  });

  it('ward snapshot returns MLA and MP names for a ward', async () => {
    const r = await db.query<{ s: { mla: string; mp: string; name: string } }>(`SELECT public_ward_snapshot('west-19') AS s`);
    expect(r.rows[0]!.s.mla).toBe('S. T. Somashekar');
    expect(r.rows[0]!.s.mp).toBe('Shobha Karandlaje');
    expect(r.rows[0]!.s.name).toBe('Shivanapalya');
  });
});
