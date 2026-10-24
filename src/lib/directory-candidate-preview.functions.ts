import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
export const directoryCandidatePreview=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator((data:unknown)=>z.object({id:z.string().uuid()}).parse(data)).handler(async({data,context})=>{
 const [role,active]=await Promise.all([context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'}),context.supabase.rpc('account_active',{_user:context.userId})]);
 if(!role.data||!active.data)throw new Error('Active administrator access required.');
 const job=await context.supabase.from('civic_directory_jobs').select('storage_path').eq('id',data.id).eq('status','review').single();if(job.error||!job.data.storage_path)throw new Error('Candidate image unavailable.');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const r=await supabaseAdmin.storage.from('officer-portraits').createSignedUrl(job.data.storage_path,120);if(r.error)throw new Error('Candidate preview unavailable.');
 return {url:r.data.signedUrl};
});