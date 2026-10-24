import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { CATEGORIES } from '@/lib/civic';
export const staffPasswordRule=(pw:string)=>pw.length>=12&&/[a-z]/.test(pw)&&/[A-Z]/.test(pw)&&/\d/.test(pw);
async function assertAdmin(context:{supabase:any;userId:string}){const r=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(!r.data)throw new Error('Administrator access required.');}
const schema=z.object({email:z.string().trim().toLowerCase().email(),fullName:z.string().trim().min(2).max(120),designation:z.string().trim().min(2).max(120),department:z.string().trim().min(2).max(160),role:z.enum(['field_worker','supervisor','admin']),categories:z.array(z.string()).max(30),wards:z.array(z.string()).max(400),teamIds:z.array(z.string().uuid()).default([]),corporations:z.array(z.string()).default([])});
export const createStaffAccount=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:z.input<typeof schema>)=>schema.parse(input)).handler(async({data,context})=>{
 await assertAdmin(context);
 if(data.role==='admin'){const r=await context.supabase.rpc('can_manage_admins',{_user:context.userId});if(!r.data)throw new Error('Administrator creation has not been delegated to you.');}
 if(data.categories.some(c=>!CATEGORIES.some(x=>x.id===c)))throw new Error('Unsupported category.');
 if(data.role!=='admin'){
 const r=await context.supabase.from('civic_teams').select('*').eq('active',true).eq('department',data.department);
 const eligible=(r.data??[]).filter(t=>data.categories.every(c=>t.categories.includes(c)));
 if(!data.categories.length||!eligible.length||data.teamIds.some(id=>!eligible.some(t=>t.id===id)))throw new Error('Select categories and teams from a configured department.');
 }
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const r=await supabaseAdmin.auth.admin.inviteUserByEmail(data.email,{redirectTo:'https://siddifix.lovable.app/reset-password',data:{full_name:data.fullName}});
 if(r.error||!r.data.user)throw new Error('Invitation could not be sent. Check whether the account already exists.');
 const setup=await supabaseAdmin.rpc('admin_provision_account',{_user:r.data.user.id,_role:data.role,_profile:data,_actor:context.userId});
 if(setup.error){await supabaseAdmin.auth.admin.deleteUser(r.data.user.id);throw new Error('Access setup failed; the incomplete account was removed.');}
 return {id:r.data.user.id};
});
export const setStaffSuspended=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:{userId:string;suspend:boolean;reason:string})=>z.object({userId:z.string().uuid(),suspend:z.boolean(),reason:z.string().trim().min(3).max(300)}).parse(input)).handler(async({data,context})=>{
 await assertAdmin(context);
 const state=await context.supabase.rpc('admin_set_account_state',{_user:data.userId,_active:!data.suspend,_reason:data.reason});if(state.error)throw new Error(state.error.message);
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const r=await supabaseAdmin.auth.admin.updateUserById(data.userId,{ban_duration:data.suspend?'876000h':'none'});
 return {ok:true,openCases:state.data??0,authSyncPending:Boolean(r.error)};
});
export const resetStaffAccess=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:{userId:string})=>z.object({userId:z.string().uuid()}).parse(input)).handler(async({data,context})=>{
 await assertAdmin(context);
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const roles=await supabaseAdmin.from('user_roles').select('role').eq('user_id',data.userId);
 if(roles.data?.some(r=>r.role==='admin')){const allowed=await context.supabase.rpc('can_manage_admins',{_user:context.userId});if(!allowed.data)throw new Error('Administrator access management not delegated.');}
 const user=await supabaseAdmin.auth.admin.getUserById(data.userId);if(!user.data.user?.email)throw new Error('Account unavailable.');
 const r=await supabaseAdmin.auth.resetPasswordForEmail(user.data.user.email,{redirectTo:'https://siddifix.lovable.app/reset-password'});if(r.error)throw new Error('Recovery email could not be requested.');
 const a=await supabaseAdmin.from('civic_directory_audit').insert({table_name:'staff_accounts',record_id:data.userId,action:'recovery_requested',actor_id:context.userId});if(a.error)throw new Error('Recovery requested but audit recording failed.');return {ok:true};
});
