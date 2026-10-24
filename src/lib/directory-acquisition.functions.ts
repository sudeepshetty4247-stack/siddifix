import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { allowedDirectoryUrl, validPortrait } from './directory-acquisition';
const safeUrl=z.string().url().refine(allowedDirectoryUrl,'Use an approved official or licensed Commons source');
export const queueDirectoryFetch=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({personId:z.string().uuid(),kind:z.enum(['portrait','contact']),sourceUrl:safeUrl,imageUrl:safeUrl.optional(),licenseUrl:z.string().url().optional(),credit:z.string().max(300).optional(),identityEvidence:z.string().min(30).max(2000)}).parse(input)).handler(async({data,context})=>{
  const [role,active]=await Promise.all([context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'}),context.supabase.rpc('account_active',{_user:context.userId})]);if(!role.data||!active.data)throw new Error('Active administrator access required.');
  if(data.kind==='portrait'&&(!data.imageUrl||!data.licenseUrl||!data.credit))throw new Error('Portrait candidates need an image URL, rights evidence and attribution.');
  const r=await context.supabase.from('civic_directory_jobs').upsert({person_id:data.personId,kind:data.kind,source_url:data.sourceUrl,image_url:data.imageUrl??null,license_url:data.licenseUrl??null,credit:data.credit??null,identity_evidence:data.identityEvidence,created_by:context.userId},{onConflict:'person_id,kind,source_url',ignoreDuplicates:true});if(r.error)throw new Error('Candidate could not be queued.');return {ok:true};
});
export const runDirectoryFetch=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const [role,active]=await Promise.all([context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'}),context.supabase.rpc('account_active',{_user:context.userId})]);if(!role.data||!active.data)throw new Error('Active administrator access required.');
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const selected=await supabaseAdmin.from('civic_directory_jobs').select('*').in('status',['pending','failed','fetching']).lt('attempts',4).lte('next_attempt_at',new Date().toISOString()).order('created_at').limit(3);if(selected.error)throw new Error('Fetch queue unavailable.');
  const results=[];
  for(const job of selected.data??[]) {
    const now=new Date();const claim=await supabaseAdmin.from('civic_directory_jobs').update({status:'fetching',attempts:job.attempts+1,updated_at:now.toISOString(),next_attempt_at:new Date(+now+120000).toISOString()}).eq('id',job.id).eq('attempts',job.attempts).select('id');if(!claim.data?.length)continue;
    try {
      if(!allowedDirectoryUrl(job.source_url)|| (job.image_url&&!allowedDirectoryUrl(job.image_url)))throw new Error('Source host is not approved');
      const source=await fetch(job.source_url,{signal:AbortSignal.timeout(12000),redirect:'error'});if(!source.ok)throw new Error(`Source returned ${source.status}`);const sourceReader=source.body?.getReader();if(!sourceReader)throw new Error('Source body missing');let sourceSize=0;const sourceChunks:Uint8Array[]=[];while(true){const chunk=await sourceReader.read();if(chunk.done)break;sourceSize+=chunk.value.length;if(sourceSize>2000000){await sourceReader.cancel();throw new Error('Source page exceeds review limit');}sourceChunks.push(chunk.value);}const sourceBytes=new Uint8Array(sourceSize);let sourceOffset=0;for(const chunk of sourceChunks){sourceBytes.set(chunk,sourceOffset);sourceOffset+=chunk.length;}const text=new TextDecoder().decode(sourceBytes);
      const evidence=await supabaseAdmin.storage.from('officer-source-evidence').upload(`${job.id}.html`,sourceBytes,{contentType:'text/html',upsert:true});if(evidence.error)throw new Error('Source evidence could not be persisted');
      if(job.kind==='contact') {
        // Never auto-publish regex matches: duty role and identity are reviewed separately.
        const emails=[...new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.(?:gov\.in|nic\.in|karnataka\.gov\.in)/gi)??[])];
        const phones=[...new Set(text.match(/(?:080[-\s]?\d{7,8}|\+91[-\s]?\d{10})/g)??[])];
        const saved=await supabaseAdmin.from('civic_directory_jobs').update({status:'review',contact_email:emails.length===1?emails[0]??null:null,contact_phone:phones.length===1?phones[0]??null:null,last_error:emails.length>1||phones.length>1?'Multiple contacts: identity matching required; no automatic assignment':null,updated_at:new Date().toISOString()}).eq('id',job.id);if(saved.error)throw new Error('Contact progress could not be saved');
      }else {
        if(!job.image_url||!job.license_url||!job.credit)throw new Error('Missing portrait rights evidence');
        const response=await fetch(job.image_url,{signal:AbortSignal.timeout(12000),redirect:'error'});if(!response.ok)throw new Error(`Image returned ${response.status}`);if(!response.headers.get('content-type')?.startsWith('image/'))throw new Error('Response is not an image');
        const length=Number(response.headers.get('content-length')??0);if(length>5*1024*1024)throw new Error('Image exceeds 5 MB');
        const reader=response.body?.getReader();if(!reader)throw new Error('Image body missing');let size=0;const chunks:Uint8Array[]=[];
        while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>5*1024*1024){await reader.cancel();throw new Error('Image exceeds 5 MB');}chunks.push(chunk.value);}
        const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
        const {imageSize}=await import('image-size');const dimensions=imageSize(bytes);if(!validPortrait(size,dimensions.width,dimensions.height,dimensions.type??''))throw new Error('Portrait size/dimensions/format invalid');
        const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');const path=`${hash}.${dimensions.type}`;
        const uploaded=await supabaseAdmin.storage.from('officer-portraits').upload(path,bytes,{contentType:response.headers.get('content-type')??'image/jpeg',upsert:true});if(uploaded.error)throw new Error('Portrait storage failed');
        const check=await supabaseAdmin.storage.from('officer-portraits').download(path);if(check.error||check.data.size!==size)throw new Error('Stored portrait could not be verified');
        const saved=await supabaseAdmin.from('civic_directory_jobs').update({status:'review',storage_path:path,sha256:hash,last_error:null,updated_at:new Date().toISOString()}).eq('id',job.id);if(saved.error)throw new Error('Progress could not be saved');
      }
      results.push({id:job.id,status:'review'});
    }catch(e){const message=e instanceof Error?e.message:'Fetch failed';await supabaseAdmin.from('civic_directory_jobs').update({status:'failed',last_error:message,updated_at:new Date().toISOString(),next_attempt_at:new Date(Date.now()+60000*2**job.attempts).toISOString()}).eq('id',job.id);results.push({id:job.id,status:'failed',error:message});}
  }
  return results;
});
export const reviewDirectoryFetch=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({id:z.string().uuid(),approve:z.boolean()}).parse(input)).handler(async({data,context})=>{
  const r=await context.supabase.rpc('review_directory_fetch',{_id:data.id,_approve:data.approve});if(r.error)throw new Error(r.error.message);return {ok:true};
});