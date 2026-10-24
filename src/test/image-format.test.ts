import { describe, expect, it } from 'vitest';
import { validateImageContainer } from '@/lib/image-format';
import { reportInputSchema } from '@/lib/report-input';

describe('Photo upload failures', () => {
  it.each(['jpeg','png','webp'])('rejects an empty %s file', format => {
    expect(() => validateImageContainer(new Uint8Array(),format)).toThrow();
  });
  it('rejects an HTML response disguised as a portrait or evidence JPEG', () => {
    expect(() => validateImageContainer(new TextEncoder().encode('<html>Access denied</html>'),'jpeg')).toThrow();
  });
  it('rejects RIFF audio disguised as a WebP original', () => {
    expect(() => validateImageContainer(new TextEncoder().encode('RIFFabcdefghWAVEabcdefgh'),'webp')).toThrow();
  });
  it('rejects PNG signature fragments', () => {
    expect(() => validateImageContainer(new Uint8Array([137,80,78,71]),'png')).toThrow();
  });
  const valid = { idempotencyKey:'11111111-1111-4111-8111-111111111111',imageDataUrl:'data:image/jpeg;base64,/9j/',title:'Photo test only',category:'roads',severity:'medium',needsClassification:false,lat:12.9716,lng:77.5946 };
  it('rejects unsupported file MIME before persistence', () => {
    expect(reportInputSchema.safeParse({...valid,imageDataUrl:'data:text/html;base64,SGVsbG8='}).success).toBe(false);
  });
  it('rejects missing location', () => {
    expect(reportInputSchema.safeParse({...valid,lat:undefined}).success).toBe(false);
  });
  it('rejects out-of-range location', () => {
    expect(reportInputSchema.safeParse({...valid,lat:91}).success).toBe(false);
  });
  it('rejects oversized descriptions', () => {
    expect(reportInputSchema.safeParse({...valid,description:'x'.repeat(1001)}).success).toBe(false);
  });
  it('rejects an oversized processed photo', () => {
    expect(reportInputSchema.safeParse({...valid,imageDataUrl:`data:image/jpeg;base64,${'A'.repeat(7_500_000)}`}).success).toBe(false);
  });
  it('rejects an unknown classification', () => {
    expect(reportInputSchema.safeParse({...valid,category:'invented-department'}).success).toBe(false);
  });
  it('rejects a subcategory belonging to a different category', () => {
    expect(reportInputSchema.safeParse({...valid,subcategory:'Sewage overflow'}).success).toBe(false);
  });
  it('accepts the roads pothole subcategory', () => {
    expect(reportInputSchema.safeParse({...valid,subcategory:'Pothole'}).success).toBe(true);
  });
});