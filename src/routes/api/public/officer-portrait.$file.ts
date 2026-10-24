import { createFileRoute } from '@tanstack/react-router';
export const Route=createFileRoute('/api/public/officer-portrait/$file')({server:{handlers:{GET:async({params})=>{
  if(!/^[a-f0-9]{64}\.(jpg|png|webp)$/.test(params.file))return new Response('Not found',{status:404});
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const approved=await supabaseAdmin.from('civic_directory_jobs').select('id').eq('storage_path',params.file).eq('status','approved').limit(1);
  if(approved.error||!approved.data?.length)return new Response('Not found',{status:404});
  const image=await supabaseAdmin.storage.from('officer-portraits').download(params.file);
  if(image.error)return new Response('Portrait unavailable',{status:503});
  return new Response(image.data,{headers:{'Content-Type':image.data.type,'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});
}}}});