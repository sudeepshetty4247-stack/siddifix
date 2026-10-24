import { describe,it,expect } from 'vitest';
import { photonResults } from '@/lib/address-search';
import { incidentCoverage } from '@/lib/incident-coverage';
import type { Directory } from '@/lib/directory';
const ward={id:'w',identifier:'east-1',name:'Fixture ward',corporation:'Fixture corporation',active:true,boundary:{type:'Polygon',coordinates:[[[77,12],[78,12],[78,13],[77,13],[77,12]]]}} as unknown as Directory['wards'][number];
const directory={coverage:[{id:'city',bounds:{south:12,north:13,west:77,east:78}}],wards:[ward],routes:[],rules:[],authorities:[]} as unknown as Directory;
describe('Authoritative incident coverage and real-provider parsing',()=>{
 it('retains real provider coordinates and filters countries without fabricating addresses',()=>{
  expect(photonResults({features:[{geometry:{coordinates:[78.47,17.36]},properties:{name:'Hyderabad',countrycode:'IN',state:'Telangana',country:'India'}},{geometry:{coordinates:[68,25]},properties:{name:'Hyderabad',countrycode:'PK'}}]})).toEqual([{lat:17.36,lng:78.47,label:'Hyderabad, Telangana, India',city:undefined,state:'Telangana',district:undefined}]);
 });
 it('rejects malformed provider responses',()=>expect(()=>photonResults({})).toThrow());
 it('matches a single active polygon and retains the correct corporation',()=>{const v=incidentCoverage(directory,12.5,77.5);expect(v.status).toBe('supported');expect(v.routing.ward?.corporation).toBe('Fixture corporation');});
 it('does not route an outside incident to a Bengaluru authority',()=>{const v=incidentCoverage(directory,17.36,78.47);expect(v.status).toBe('outside');expect(v.routing.ward).toBeNull();expect(v.routing.candidates).toEqual([]);});
 it('does not accept an ambiguous ward match',()=>{expect(incidentCoverage({...directory,wards:[ward,{...ward,id:'second',identifier:'other-1'}]},12.5,77.5).status).toBe('unknown');});
 it('does not accept points when configured coverage is absent',()=>expect(incidentCoverage({...directory,coverage:[]},12.5,77.5).status).toBe('outside'));
});