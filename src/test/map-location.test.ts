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
import { describeLiveFix } from '@/lib/map-location';
const twoWards = { wards: [
  { active: true, identifier: 'a', name: 'A', boundary: {type:'Polygon', coordinates:[[[77.5,12.9],[77.6,12.9],[77.6,13.0],[77.5,13.0],[77.5,12.9]]]} },
  { active: true, identifier: 'b', name: 'B', boundary: {type:'Polygon', coordinates:[[[77.6,12.9],[77.7,12.9],[77.7,13.0],[77.6,13.0],[77.6,12.9]]]} },
] } as unknown as Directory;
describe('Live GPS ward placement', () => {
  it('locks a precise fix (within 100 m) to the single ward containing it', () => {
    const r = describeLiveFix(twoWards, {lat:12.95,lng:77.55,accuracy:12});
    expect(r?.kind).toBe('ward');
    expect(r && r.kind === 'ward' && r.ward.identifier).toBe('a');
    expect(r && r.kind === 'ward' && r.precise).toBe(true);
  });
  it('labels a 1.5 km fix as approximate but still shows the ward', () => {
    const r = describeLiveFix(twoWards, {lat:12.95,lng:77.65,accuracy:1500});
    expect(r && r.kind === 'ward' && r.ward.identifier).toBe('b');
    expect(r && r.kind === 'ward' && r.precise).toBe(false);
  });
  it('flags a point on a shared border instead of guessing a ward', () => {
    expect(describeLiveFix(twoWards, {lat:12.95,lng:77.6,accuracy:5})?.kind).toBe('boundary');
  });
  it('reports Mysuru as outside coverage without clamping', () => {
    expect(describeLiveFix(twoWards, {lat:12.2958,lng:76.6394,accuracy:5})).toEqual({kind:'outside'});
  });
});
