import { describe, expect, it } from 'vitest';
import { decodeEvidenceImage, evidenceInput } from '@/lib/evidence-validation';
describe('Evidence validation', () => {
  it('requires an evidence description rather than a photo alone', () => {
    expect(evidenceInput.safeParse({issueId:'11111111-1111-4111-8111-111111111111',kind:'completion',note:'',imageDataUrl:'data:image/jpeg;base64,/9j/'}).success).toBe(false);
  });
  it('rejects a disguised non-image upload', () => {
    expect(()=>decodeEvidenceImage('data:image/jpeg;base64,aGVsbG8=')).toThrow();
  });
  it('rejects a truncated JPEG containing only its signature', () => {
    expect(() => decodeEvidenceImage('data:image/jpeg;base64,/9j/')).toThrow('truncated JPEG');
  });
});