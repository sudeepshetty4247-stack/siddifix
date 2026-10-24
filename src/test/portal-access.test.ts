import {describe,it,expect} from 'vitest';
import {canEnterPortal,canManageAdministrator} from '@/lib/portal-access';
const base={active:true,roles:['field_worker'],isSuperAdmin:false,canManageAdmins:false};
describe('Separate portal rules',()=>{
 it('field staff cannot enter admin',()=>expect(canEnterPortal(base,'admin')).toBe(false));
 it('field staff can enter staff',()=>expect(canEnterPortal(base,'staff')).toBe(true));
 it('administration does not enter operational staff portal',()=>expect(canEnterPortal({...base,roles:['admin']},'staff')).toBe(false));
 it('ordinary admin cannot create administrators',()=>expect(canManageAdministrator({...base,roles:['admin']})).toBe(false));
 it('explicit delegation permits administrator management',()=>expect(canManageAdministrator({...base,roles:['admin'],canManageAdmins:true})).toBe(true));
 it('super admin controls administrator access',()=>expect(canManageAdministrator({...base,roles:['admin'],isSuperAdmin:true})).toBe(true));
 it('suspended owner cannot manage access',()=>expect(canManageAdministrator({...base,roles:['admin'],isSuperAdmin:true,active:false})).toBe(false));
 it('suspended staff cannot enter protected portal',()=>expect(canEnterPortal({...base,active:false},'staff')).toBe(false));
 it('citizens cannot enter either portal',()=>{expect(canEnterPortal({...base,roles:[]},'staff')).toBe(false);expect(canEnterPortal({...base,roles:[]},'admin')).toBe(false);});
});
