import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { departmentFor, findWard, type WardData } from '@/lib/wards';

const data = JSON.parse(readFileSync('public/data/bengaluru-wards.json', 'utf8')) as WardData;

describe('Bengaluru ward lookup', () => {
  it('ships all 369 notified wards', () => expect(data.features.length).toBe(369));
  it('places Vidhana Soudha in a Central corporation ward under Shivajinagar or Gandhinagar constituency', () => {
    const w = findWard(data, 12.9796, 77.5907);
    expect(w?.corporation).toBe('Bengaluru Central City Corporation');
  });
  it('returns no ward outside Bengaluru', () => expect(findWard(data, 12.2958, 76.6394)).toBeNull());
  it('maps garbage to BSWML and power to BESCOM', () => {
    expect(departmentFor('waste').office).toContain('BSWML');
    expect(departmentFor('electricity').helpline).toBe('1912');
  });
});
