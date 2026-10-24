import { expect, it } from 'vitest';
import { descriptionOverlap } from '@/lib/duplicate-evidence';
it('uses description evidence without claiming an automatic match', () => {
  expect(descriptionOverlap('Broken streetlight near school', 'Broken streetlight near school')).toBe(1);
  expect(descriptionOverlap('Broken streetlight', 'Overflowing sewage')).toBe(0);
  expect(descriptionOverlap('', '')).toBe(0);
});