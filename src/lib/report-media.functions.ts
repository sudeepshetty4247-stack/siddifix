import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {decodeEvidenceImage} from './evidence-validation';

export const prepareOriginalUpload=createServerFn({method:'POST'}).inputValidator((input:unknown)=>z.object({key:z.string().uuid(),mime:z.enum(['image/jpeg','image/png','image/webp']),size:z.number().int().positive().max(25*1024*1024),challenge:z.object({token:z.string().max(2000),answer:z.string().max(3)}).optional()}).parse(input)).handler(async({data})=>{
  const secret=process.env['REPORT_INTEGRITY_SECRET'];if(!secret)throw new Error('Upload protection unavailable.');
  const {protectSubmission}=await import('./submission-security.server');const identity=await protectSubmission(secret,'upload',data.challenge);
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const path=`originals/${data.key}/original.${data.mime==='image/png'?'png':data.mime==='image/webp'?'webp':'jpg'}`;
  const reservation=await supabaseAdmin.from('report_upload_reservations').insert({key:data.key,session_hash:identity.session,original_path:path,expected_mime:data.mime,expected_size:data.size});
  if(reservation.error){const old=await supabaseAdmin.from('report_upload_reservations').select('*').eq('key',data.key).maybeSingle();if(!old.data||old.data.session_hash!==identity.session||old.data.original_path!==path||old.data.expected_size!==data.size||old.data.consumed||new Date(old.data.expires_at).getTime()<Date.now())throw new Error('Upload reservation does not match this session.');}
  const signed=await supabaseAdmin.storage.from('issue-photos').createSignedUploadUrl(path,{upsert:false});
  if(signed.error)throw new Error('Photo upload could not be prepared.');return {path,token:signed.data.token};
});
export const saveAnnotatedPhoto=createServerFn({method:'POST'}).inputValidator((input:{ref:string;token:string;imageDataUrl:string})=>z.object({ref:z.string().regex(/^(BLR|IND)-[A-Z2-9]{6}$/),token:z.string().regex(/^[a-f0-9]{48}$/),imageDataUrl:z.string().max(7500000)}).parse(input)).handler(async({data})=>{
  const {consumeRequest}=await import('./civic-security.server');await consumeRequest('photo-annotation',20);
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const check=await supabaseAdmin.rpc('verify_reporter_token',{_ref:data.ref,_token:data.token});if(check.error||!check.data)throw new Error('This tracking link is not valid.');
  const issue=await supabaseAdmin.from('issues').select('id').eq('ref_code',data.ref).single();if(!issue.data)throw new Error('Report unavailable.');
  const photo=await supabaseAdmin.from('issue_photos').select('id').eq('issue_id',issue.data.id).maybeSingle();if(!photo.data)throw new Error('Original photo record unavailable.');
  const {bytes,mime,extension}=decodeEvidenceImage(data.imageDataUrl);const {validateReportImage}=await import('./report-image.server');validateReportImage(bytes,mime,5500000);const path=`annotated/${issue.data.id}/${crypto.randomUUID()}.${extension}`;
  const uploaded=await supabaseAdmin.storage.from('issue-photos').upload(path,bytes,{contentType:`image/${mime}`,upsert:false});if(uploaded.error)throw new Error('Annotated photo could not be saved.');
  const saved=await supabaseAdmin.from('issue_photos').update({annotated_path:path}).eq('id',photo.data.id);if(saved.error)throw new Error('Annotated photo could not be recorded.');return {ok:true};
});
export const getReportPhoto=createServerFn({method:'GET'}).inputValidator((input:{issueId:string})=>z.object({issueId:z.string().uuid()}).parse(input)).handler(async({data})=>{
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const result=await supabaseAdmin.from('issue_photos').select('annotated_path,metadata').eq('issue_id',data.issueId).maybeSingle();
  if(!result.data?.annotated_path)return {url:null,metadata:null};const signed=await supabaseAdmin.storage.from('issue-photos').createSignedUrl(result.data.annotated_path,3600);return {url:signed.data?.signedUrl??null,metadata:result.data.metadata};
});