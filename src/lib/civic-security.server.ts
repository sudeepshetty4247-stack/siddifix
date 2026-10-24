import { getRequestHeader } from '@tanstack/react-start/server';

export async function consumeRequest(kind:string,limit:number) {
  const ip=getRequestHeader('cf-connecting-ip') ?? getRequestHeader('x-forwarded-for')?.split(',')[0]?.trim() ?? 'shared-unknown';
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${kind}:${ip}`));
  const key=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const result=await supabaseAdmin.rpc('consume_civic_request',{_key:`${kind}:${key}`,_limit:limit});
  if(result.error||!result.data)throw new Error('Too many requests. Please wait a few minutes before trying again.');
}