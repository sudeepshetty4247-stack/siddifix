import { describe, expect, it } from 'vitest';
import { citizenMapFocus } from '@/lib/map-location';
import type { Directory } from '@/lib/directory';

const directory = { wards: [{ active: true, boundary: {type:'Polygon', coordinates:[[[77.5,12.9],[77.7,12.9],[77.7,13.1],[77.5,13.1],[77.5,12.9]]]}}] } as unknown as Directory;
describe('Citizen map location', () => {
  it('uses exact device coordinates rather than a ward preview point', () => {
    expect(citizenMapFocus(directory, {lat:12.9796,lng:77.5907,label:'GPS',method:'device',accuracy:10})).toEqual({lat:12.9796,lng:77.5907});
  });
  it('preserves the confirmed manual pin', () => {
    expect(citizenMapFocus(directory, {lat:12.97,lng:77.61,label:'Pin',method:'manual'})).toEqual({lat:12.97,lng:77.61});
  });
  it('does not present poor GPS as an exact map focus', () => {
    expect(citizenMapFocus(directory, {lat:12.97,lng:77.61,label:'GPS',method:'device',accuracy:2000})).toBeNull();
  });
  it('does not clamp Mysuru into a Bengaluru ward', () => {
    expect(citizenMapFocus(directory, {lat:12.2958,lng:76.6394,label:'Mysuru',method:'manual'})).toBeNull();
  });
});