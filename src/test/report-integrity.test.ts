// @vitest-environment node
import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {validateReportImage} from '@/lib/report-image.server';
import {explainReportRisk,challengeAnswer,integrityConfigSchema,DEFAULT_INTEGRITY_CONFIG} from '@/lib/report-integrity';
import {reportInputSchema} from '@/lib/report-input';
const clear={reusedImage:false,repeatedContent:false,nearbyDuplicate:false,burst:false,locationMismatch:false,incomplete:false};
describe('Respectful explainable integrity signals',()=>{
  it('does not penalize anonymity, new users, or missing photos',()=>expect(explainReportRisk(clear)).toEqual({score:0,signals:[]}));
  it('flags reuse without claiming fraud',()=>expect(explainReportRisk({...clear,reusedImage:true})).toMatchObject({score:30,signals:[{code:'reused_image',points:30}]}));
  it('keeps duplicate signals distinct from invalidity',()=>expect(explainReportRisk({...clear,nearbyDuplicate:true})).toMatchObject({score:15,signals:[{code:'possible_duplicate'}]}));
  it('bounds combined signal score',()=>expect(explainReportRisk({reusedImage:true,repeatedContent:true,nearbyDuplicate:true,burst:true,locationMismatch:true,incomplete:true}).score).toBe(100));
  it('uses a checked numeric verification answer',()=>{expect(challengeAnswer(3,4,'7')).toBe(true);expect(challengeAnswer(3,4,'8')).toBe(false);expect(challengeAnswer(3,4,'7<script>')).toBe(false);});
  it('constrains configurable limits',()=>{expect(integrityConfigSchema.safeParse(DEFAULT_INTEGRITY_CONFIG).success).toBe(true);expect(integrityConfigSchema.safeParse({...DEFAULT_INTEGRITY_CONFIG,session_limit:0}).success).toBe(false);});
  it('allows meaningful anonymous text-only reports',()=>{const input={idempotencyKey:'11111111-1111-4111-8111-111111111111',imageDataUrl:null,title:'Broken streetlight',description:'Streetlight has not worked for several nights',category:'electricity',severity:'medium',needsClassification:true,lat:12.97,lng:77.59};expect(reportInputSchema.safeParse(input).success).toBe(true);expect(reportInputSchema.safeParse({...input,description:'short'}).success).toBe(false);});
});
describe('Actual upload content validation',()=>{
  it('decodes a real JPEG',()=>expect(validateReportImage(readFileSync('src/test/fixtures/civic-photos/001_potholes.jpg'),'jpeg').width).toBeGreaterThan(0));
  it('decodes a real PNG with CRC verification',()=>expect(validateReportImage(readFileSync('src/test/fixtures/civic-photos/format-test.png'),'png').height).toBeGreaterThan(0));
  it('checks bounded genuine WebP framing',()=>expect(validateReportImage(readFileSync('src/test/fixtures/civic-photos/format-test.webp'),'webp').width).toBeGreaterThan(0));
  it('rejects executable content renamed as an image',()=>expect(()=>validateReportImage(new TextEncoder().encode('<script>alert(1)</script>'),'jpeg')).toThrow());
  it('rejects MIME mismatch',()=>expect(()=>validateReportImage(readFileSync('src/test/fixtures/civic-photos/format-test.png'),'jpeg')).toThrow());
  it('rejects oversize uploads before decoding',()=>expect(()=>validateReportImage(new Uint8Array(26*1024*1024),'jpeg')).toThrow('size'));
  it('rejects damaged pixel data with matching JPEG endpoints',()=>expect(()=>validateReportImage(new Uint8Array([255,216,255,0,0,0,0,0,0,0,255,217]),'jpeg')).toThrow());
});