/**
 * Official GBA ward file used only as an import source for administrators.
 * Live case screens read the editable ward records from the database.
 */
export type WardFileProps = {
  id: string; no: number; name: string; name_kn: string | null; corporation: string; zone: string | null;
  ac_no: number; ac: string; mla: string; mla_party: string; ls: string; mp: string; population: number;
  official_name: string | null; flags: string[];
};
export type WardFile = { source: string; notified: string; checked_at?: string; sha256?: string; representatives_source: string; features: { geometry: unknown; properties: WardFileProps }[] };

export const WARD_SOURCE_URL = 'https://data.opencity.in/dataset/gba-wards-delimitation-2025';
export const CORPORATIONS = ['Central', 'East', 'North', 'South', 'West'].map(c => `Bengaluru ${c} City Corporation`);

export async function loadWardFile(): Promise<WardFile> {
  const r = await fetch('/data/bengaluru-wards.json');
  if (!r.ok) throw new Error('The official ward file could not be loaded.');
  return r.json() as Promise<WardFile>;
}

export type WardIssue = { id: string; message: string };
/** Structural validation of a ward set. Returns problems; never edits records. */
export function validateWardSet(rows: { identifier: string; corporation: string; source_url: string | null; boundary: unknown; official_name?: string | null; name: string }[], expected = 369): WardIssue[] {
  const issues: WardIssue[] = [];
  if (rows.length !== expected) issues.push({ id: '*', message: `Expected ${expected} wards, found ${rows.length}` });
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.identifier)) issues.push({ id: r.identifier, message: 'Duplicate ward ID' });
    seen.add(r.identifier);
    if (!CORPORATIONS.includes(r.corporation)) issues.push({ id: r.identifier, message: `Unknown corporation “${r.corporation}”` });
    if (!r.source_url) issues.push({ id: r.identifier, message: 'Missing source link' });
    const b = r.boundary as { type?: string; coordinates?: unknown[] } | null;
    if (!b || !Array.isArray(b.coordinates) || b.coordinates.length === 0) issues.push({ id: r.identifier, message: 'Missing or empty boundary' });
    if (!r.official_name) issues.push({ id: r.identifier, message: 'Not found in official division list' });
  }
  return issues;
}

export function fileToRows(file: WardFile) {
  return file.features.map(({ geometry, properties: p }) => ({
    coverage_id: 'bengaluru', identifier: p.id, name: p.name, name_kn: p.name_kn, official_name: p.official_name,
    corporation: p.corporation, zone: p.zone, ward_number: p.no, boundary: geometry as never,
    source_url: file.source, verified_at: file.checked_at?.slice(0, 10) ?? file.notified, source_published_at: file.notified, source_checked_at: file.checked_at ?? null, source_sha256: file.sha256 ?? null, population: p.population,
    assembly_no: p.ac_no, assembly: p.ac,
    // Names are recorded as candidates; they stay "verification required" until staff confirm them against ECI.
    mla: null, mla_party: null, lok_sabha: p.ls || null, mp: null, representative_source_url: null,
    representative_status: 'verification_required',
    verification_status: p.flags.length ? 'flagged' : 'verification_required',
    flags: p.flags,
  }));
}

export type WardCount = { ward_identifier: string; reports: number; unique_issues: number; unresolved: number; resolved: number };
export function rankWards(counts: WardCount[], names: Map<string, string>, limit = 10) {
  return counts.filter(c => names.has(c.ward_identifier))
    .sort((a, b) => b.unresolved - a.unresolved || b.unique_issues - a.unique_issues)
    .slice(0, limit).map(c => ({ ...c, name: names.get(c.ward_identifier) ?? c.ward_identifier }));
}
