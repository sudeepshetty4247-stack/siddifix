// @vitest-environment node
// Runs the migration-defined citizen feedback function in isolated PostgreSQL.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
const db = new PGlite();
function source(name: string) {
  const s = readFileSync('drizzle/migrations/0041_citizen_feedback_survey.sql', 'utf8');
  const start = s.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  const end = s.indexOf('$$;', s.indexOf('AS $$', start) + 5) + 3;
  return s.slice(start, end);
}
const submit = (ref: string, token: string, resolution = 'complete', rating = 5) =>
  db.query(`select citizen_submit_feedback($1,$2,$3,$4,'good','')`, [ref, token, rating, resolution]);
describe('Citizen feedback survey', () => {
  beforeAll(async () => {
    await db.exec(`CREATE TYPE issue_status AS ENUM('submitted','assigned','resolved','reopened','closed');
      CREATE TABLE issues(id uuid PRIMARY KEY,ref_code text,status issue_status);
      CREATE TABLE issue_events(id uuid DEFAULT gen_random_uuid(),issue_id uuid,kind text,from_status issue_status,to_status issue_status,actor_label text,note text);
      CREATE TABLE issue_feedback(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),issue_id uuid NOT NULL,rating smallint NOT NULL,resolution text NOT NULL,response_time text NOT NULL,comment text,survey_version int NOT NULL DEFAULT 1,status_at_submission issue_status NOT NULL,submitted_at timestamptz DEFAULT now(),UNIQUE(issue_id,survey_version));
      CREATE FUNCTION verify_reporter_token(text,text) RETURNS boolean LANGUAGE sql AS $$ SELECT $2='ok' $$;
      INSERT INTO issues VALUES('11111111-1111-4111-8111-111111111111','BLR-OPEN','assigned'),('22222222-2222-4222-8222-222222222222','BLR-DONE','resolved'),('33333333-3333-4333-8333-333333333333','BLR-NOTFIXED','resolved');`);
    await db.exec(source('citizen_submit_feedback').replaceAll('public.issue_status', 'issue_status'));
  });
  afterAll(async () => db.close());
  it('rejects an invalid tracking token', async () => { await expect(submit('BLR-DONE', 'bad')).rejects.toThrow('not valid'); });
  it('rejects feedback before the case is resolved', async () => { await expect(submit('BLR-OPEN', 'ok')).rejects.toThrow('once the case is marked resolved'); });
  it('rejects a rating outside 1 to 5', async () => { await expect(submit('BLR-DONE', 'ok', 'complete', 6)).rejects.toThrow('Invalid feedback'); });
  it('saves once and blocks a second submission without closing the case', async () => {
    await submit('BLR-DONE', 'ok');
    await expect(submit('BLR-DONE', 'ok')).rejects.toThrow('already submitted');
    const r = await db.query<{ status: string }>("select status from issues where ref_code='BLR-DONE'");
    expect(r.rows[0]!.status).toBe('resolved');
  });
  it('reopens a resolved case when the reporter says it is not resolved', async () => {
    await submit('BLR-NOTFIXED', 'ok', 'not_resolved', 1);
    const r = await db.query<{ status: string }>("select status from issues where ref_code='BLR-NOTFIXED'");
    expect(r.rows[0]!.status).toBe('reopened');
  });
});
