import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

export const getPortalAccess = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const [active, roles, permissions, profile] = await Promise.all([
    context.supabase.rpc('account_active', { _user: context.userId }),
    context.supabase.from('user_roles').select('role').eq('user_id', context.userId),
    context.supabase.from('admin_permissions').select('is_super_admin,can_manage_admins').eq('user_id', context.userId).maybeSingle(),
    context.supabase.from('staff_profiles').select('*').eq('user_id', context.userId).maybeSingle(),
  ]);
  if (active.error || roles.error || permissions.error || profile.error) throw new Error('Could not verify portal access.');
  return { active: active.data === true, roles: active.data ? (roles.data ?? []).map(r => r.role) : [], isSuperAdmin: permissions.data?.is_super_admin ?? false, canManageAdmins: permissions.data?.can_manage_admins ?? false, profile: profile.data, userId: context.userId, email: String(context.claims.email ?? '') };
});

export const startOwnerInvitation = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const role = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
  if (!role.data) throw new Error('Administrator access required.');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const claim = await supabaseAdmin.rpc('claim_owner_invitation');
  if (claim.error || !claim.data) throw new Error('Owner setup is already complete or an invitation is pending.');
  const invited = await supabaseAdmin.auth.admin.inviteUserByEmail(claim.data, { redirectTo: 'https://siddifix.lovable.app/reset-password' });
  if (invited.error || !invited.data.user) throw new Error('Owner invitation could not be sent. No Super Admin was provisioned.');
  const completed = await supabaseAdmin.rpc('complete_siddi_owner_setup', { _user: invited.data.user.id });
  if (completed.error) throw new Error('Invitation sent, but ownership could not be saved. Administrator review is required.');
  return { success: true };
});

export const setAdminDelegation = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input: { userId: string; allow: boolean }) => z.object({ userId: z.string().uuid(), allow: z.boolean() }).parse(input)).handler(async ({ data, context }) => {
  const r = await context.supabase.rpc('admin_set_delegation', { _user: data.userId, _allow: data.allow });
  if (r.error) throw new Error(r.error.message);
  return { ok: true };
});

export const portalMetrics = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const r = await context.supabase.rpc('civic_case_metrics');
  if (r.error) throw new Error('Metrics unavailable.');
  const metrics = r.data as Record<string, unknown>;
  const admin = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
  if (!admin.data) return metrics;
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const [profiles, roles] = await Promise.all([supabaseAdmin.from('staff_profiles').select('user_id,active'), supabaseAdmin.from('user_roles').select('user_id,role')]);
  if (profiles.error || roles.error) throw new Error('Account totals unavailable.');
  const ids = new Set((roles.data ?? []).filter(r => r.role !== 'admin').map(r => r.user_id));
  return { ...metrics, active_staff: (profiles.data ?? []).filter(p => ids.has(p.user_id) && p.active).length, suspended_staff: (profiles.data ?? []).filter(p => ids.has(p.user_id) && !p.active).length } as Record<string, unknown>;
});
