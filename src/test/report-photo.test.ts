import {describe,it,expect} from 'vitest';
import {embeddedPhotoMetadata,annotationLines} from '@/lib/report-photo';
describe('Photo provenance',()=>{
 it('does not assign current GPS to a gallery photo without metadata',()=>expect(embeddedPhotoMetadata(null).gps).toBeNull());
 it('reads valid embedded coordinates',()=>expect(embeddedPhotoMetadata({latitude:12.9796,longitude:77.5907}).gps).toMatchObject({lat:12.9796,lng:77.5907,source:'embedded'}));
 it('rejects invalid embedded coordinates',()=>expect(embeddedPhotoMetadata({latitude:190,longitude:77}).gps).toBeNull());
 it('keeps corrected report coordinates separate from embedded photo coordinates',()=>{
  const lines=annotationLines(embeddedPhotoMetadata({latitude:12.9796,longitude:77.5907}),{lat:12.9352,lng:77.6245},null,'BLR-ABC234');
  expect(lines).toContain('Report location: 12.93520, 77.62450');
  expect(lines).toContain('Embedded photo GPS (unverified): 12.97960, 77.59070');
 });
 it('does not invent photo capture time',()=>expect(embeddedPhotoMetadata({}).capturedAt).toBeNull());
});