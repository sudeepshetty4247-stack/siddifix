import {createServerFn} from '@tanstack/react-start';
import {getRequestHeader} from '@tanstack/react-start/server';
import {z} from 'zod';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {integrityConfigSchema,DEFAULT_INTEGRITY_CONFIG} from './report-integrity';
import {CASE_REF_RE,TRACKING_TOKEN_RE} from './tracking-token';

export const reportChallenge=createServerFn({method:'POST'}).handler(async()=>{
  const secret=process.env['REPORT_INTEGRITY_SECRET'];if(!secret)throw new Error('Report protection is temporarily unavailable.');
  const {integrityIdentity,digest}=await import('./report-integrity.server');const identity=await integrityIdentity(secret);
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const rate=await supabaseAdmin.rpc('consume_report_limits',{_session:identity.session,_network:identity.network,_user:null,_phase:'challenge'});
  if(rate.error||!(rate.data as {allowed?:boolean})?.allowed)throw new Error('Please wait before requesting another verification.');
  const a=crypto.getRandomValues(new Uint8Array(1))[0]??1;const b=crypto.getRandomValues(new Uint8Array(1))[0]??2;
  const x=a%9+1,y=b%9+1;const payload={nonce:crypto.randomUUID(),session:identity.session,expires:Date.now()+300000,a:x,b:y};
  const encoded=btoa(JSON.stringify(payload));return {question:`What is ${x} + ${y}?`,token:`${encoded}.${await digest(encoded,secret)}`};
});

export const integritySettings=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const active=await context.supabase.rpc('account_active',{_user:context.userId});const role=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
  if(!active.data||!role.data)throw new Error('Administrator access required');
  const result=await context.supabase.from('report_integrity_settings').select('*').eq('id',true).maybeSingle();if(result.error)throw new Error('Settings unavailable');return {...DEFAULT_INTEGRITY_CONFIG,...result.data};
});
export const saveIntegritySettings=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>integrityConfigSchema.parse(input)).handler(async({context,data})=>{
  const result=await context.supabase.rpc('admin_integrity_settings',{_settings:data});if(result.error)throw new Error(result.error.message);return {ok:true};
});
const privateInput=z.object({ref:z.string().regex(CASE_REF_RE),token:z.string().regex(TRACKING_TOKEN_RE)});
export const citizenIntegrityStatus=createServerFn({method:'POST'}).inputValidator((input:unknown)=>privateInput.parse(input)).handler(async({data})=>{
  const {consumeRequest}=await import('./civic-security.server');await consumeRequest('integrity-status',30);
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const r=await supabaseAdmin.rpc('report_integrity_status',{_ref:data.ref,_token:data.token});if(r.error)throw new Error('Review details unavailable');return r.data as {state:string;reason:string|null;updated_at:string}|null;
});
export const citizenIntegrityResponse=createServerFn({method:'POST'}).inputValidator((input:unknown)=>privateInput.extend({note:z.string().trim().min(5).max(1000)}).parse(input)).handler(async({data})=>{
  const {consumeRequest}=await import('./civic-security.server');await consumeRequest('integrity-response',10);
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const r=await supabaseAdmin.rpc('citizen_integrity_response',{_ref:data.ref,_token:data.token,_note:data.note});if(r.error)throw new Error(r.error.message);return {ok:true};
});