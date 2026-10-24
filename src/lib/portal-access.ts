export type PortalAccess = { active: boolean; roles: string[]; isSuperAdmin: boolean; canManageAdmins: boolean };
export function canEnterPortal(access: PortalAccess, portal: 'admin' | 'staff') {
  if (!access.active) return false;
  if (portal === 'admin') return access.roles.includes('admin');
  return !access.roles.includes('admin') && access.roles.some(r => ['staff','supervisor','field_worker'].includes(r));
}
export function canManageAdministrator(access: PortalAccess) {
  return access.active && access.roles.includes('admin') && (access.isSuperAdmin || access.canManageAdmins);
}
