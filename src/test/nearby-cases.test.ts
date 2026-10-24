import {describe,it,expect} from 'vitest';
import {distanceMetres,NEARBY_RADIUS_METRES} from '@/lib/nearby-cases';
describe('Nearby case distances',()=>{
  it('keeps the same location at zero distance',()=>expect(distanceMetres({lat:12.89,lng:77.64},{lat:12.89,lng:77.64})).toBe(0));
  it('includes a close Kudlu-area point and excludes a distant one',()=>{
    const point={lat:12.89,lng:77.64};
    expect(distanceMetres(point,{lat:12.90,lng:77.64})).toBeLessThan(NEARBY_RADIUS_METRES);
    expect(distanceMetres(point,{lat:12.92,lng:77.64})).toBeGreaterThan(NEARBY_RADIUS_METRES);
  });
});