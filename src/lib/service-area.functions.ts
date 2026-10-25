import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Database } from '@/integrations/supabase/types';
export const getServiceAreas = createServerFn({ method: 'GET' }).handler(async () => {
 const url=process.env['SUPABASE_URL']; const key=process.env['SUPABASE_PUBLISHABLE_KEY'];
 if(!url||!key) throw new Error('Service areas unavailable.');
 const c=createClient<Database>(url,key,{auth:{persistSession:false},global:{fetch:(input,init)=>{const h=new Headers(init?.headers);if(key.startsWith('sb_')&&h.get('Authorization')===`Bearer ${key}`)h.delete('Authorization');h.set('apikey',key);return fetch(input,{...init,headers:h});}}});
 const r=await c.from('civic_coverage').select('id,name,settings,reporting_enabled,notice,source_url,bounds').eq('enabled',true).order('name');
 if(r.error)throw new Error('Service areas unavailable.'); return r.data;
});
export const saveServiceArea=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({id:z.string(),name:z.string().min(2),settings:z.record(z.unknown()),bounds:z.record(z.unknown()),source:z.string().url(),reporting:z.boolean()}).parse(input)).handler(async({data,context})=>{
 const r=await context.supabase.rpc('admin_save_service_area',{_id:data.id,_name:data.name,_settings:JSON.parse(JSON.stringify(data.settings)),_bounds:JSON.parse(JSON.stringify(data.bounds)),_source:data.source,_reporting:data.reporting});if(r.error)throw new Error(r.error.message);return {ok:true};
});
export const setStaffServiceAreas=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({user:z.string().uuid(),areas:z.array(z.string()).min(1)}).parse(input)).handler(async({data,context})=>{const r=await context.supabase.rpc('admin_set_area_scope',{_user:data.user,_areas:data.areas});if(r.error)throw new Error(r.error.message);return {ok:true};});
export const createAreaTeam=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({area:z.string(),name:z.string().min(3),department:z.string().min(2),categories:z.array(z.string()).min(1)}).parse(input)).handler(async({data,context})=>{const r=await context.supabase.rpc("admin_create_area_team",{_area:data.area,_name:data.name,_department:data.department,_categories:data.categories,_wards:[],_active:false});if(r.error)throw new Error(r.error.message);return {id:r.data};});
