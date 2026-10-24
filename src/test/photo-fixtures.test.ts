import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import manifest from './fixtures/civic-photos/manifest.json';
import { reportInputSchema } from '@/lib/report-input';
import { validateImageContainer } from '@/lib/image-format';
import { CATEGORIES } from '@/lib/civic';
import { pointInGeometry } from '@/lib/directory';
import type { WardFile } from '@/lib/wards';

const wards = JSON.parse(readFileSync('public/data/bengaluru-wards.json','utf8')) as WardFile;
describe('40 licensed photo scenarios — no live writes', () => {
  it('has 40 unique scenario IDs, source photographs and fixture hashes', () => {
    expect(manifest.records).toHaveLength(40);
    expect(new Set(manifest.records.map(r => r.test_id)).size).toBe(40);
    expect(new Set(manifest.records.map(r => r.source_page_url)).size).toBe(40);
    expect(new Set(manifest.records.map(r => r.fixture_sha256)).size).toBe(40);
    const counts = new Map<string,number>();
    manifest.records.forEach(r => counts.set(r.category_scenario,(counts.get(r.category_scenario) ?? 0)+1));
    expect(counts.size).toBe(20);
    expect([...counts.values()]).toEqual(Array(20).fill(2));
  });
  it.each(manifest.records)('$test_id: validates image, provenance, manual classification and verified corporation', r => {
    const bytes = readFileSync(`src/test/fixtures/civic-photos/${r.local_filename}`);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(r.fixture_sha256);
    expect(() => validateImageContainer(bytes,'jpeg')).not.toThrow();
    expect(r.licence).toMatch(/CC|Public domain/);
    expect(r.source_page_url).toMatch(/^https:\/\/commons.wikimedia.org\/wiki\/File/);
    expect(r.author_text.length).toBeGreaterThan(0);
    const category=CATEGORIES.find(c => c.id===r.category);
    expect(category).toBeDefined();
    expect(category?.subs.some(s => s===r.subcategory)).toBe(true);
    const input={idempotencyKey:'11111111-1111-4111-8111-111111111111',imageDataUrl:`data:image/jpeg;base64,${bytes.toString('base64')}`,title:`TEST ONLY ${r.test_id}`,description:r.identity_subject_evidence.slice(0,1000),category:r.category,subcategory:r.subcategory,severity:'medium',needsClassification:false,lat:r.location.lat,lng:r.location.lng};
    expect(reportInputSchema.safeParse(input).success).toBe(true);
    const matches=wards.features.filter(w => pointInGeometry(input.lat,input.lng,w.geometry));
    expect(matches).toHaveLength(1);
    expect(matches[0]?.properties.corporation).toBe(r.location.corporation);
    expect(r.test_only).toBe(true);
  });
  it.each(['png','webp'])('accepts a genuinely encoded %s photo', format => {
    const bytes=readFileSync(`src/test/fixtures/civic-photos/format-test.${format}`);
    expect(() => validateImageContainer(bytes,format)).not.toThrow();
    expect(() => validateImageContainer(bytes,'jpeg')).toThrow();
  });
});