import { describe, it, expect } from 'vitest';
import { te } from '@/lib/locales/te';
import { kn } from '@/lib/locales/kn';
describe('Shared multilingual resources',()=>{
 it('provides a Kannada value for every shared Telugu interface key',()=>{
  const missing=Object.keys(te).filter(key=>!(key in kn));
  expect(missing).toEqual([]);
  expect(Object.values(kn).every(value=>value.trim().length>0)).toBe(true);
 });
});