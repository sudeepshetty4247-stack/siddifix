import { describe, expect, it } from 'vitest';
import { authorityMatchesWard } from '@/lib/authority-scope';
const ward={identifier:'south-60',corporation:'Bengaluru South City Corporation',zone:'Bommanahalli'};
const mp={kind:'mp',ward_identifier:'south-60',corporation:ward.corporation,category:null,zone:'Bangalore South'};
describe('Authority scope',()=>{
  it('does not confuse MP constituency with operational city zone',()=>expect(authorityMatchesWard(mp,ward)).toBe(true));
  it('does not show a representative for another ward',()=>expect(authorityMatchesWard({...mp,ward_identifier:'south-61'},ward)).toBe(false));
  it('still scopes operational officers by city zone',()=>expect(authorityMatchesWard({...mp,kind:'operational'},ward)).toBe(false));
  it('does not show a mismatched corporation',()=>expect(authorityMatchesWard({...mp,corporation:'Bengaluru North City Corporation'},ward)).toBe(false));
});