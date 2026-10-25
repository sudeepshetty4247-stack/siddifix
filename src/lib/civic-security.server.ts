import { getRequestHeader } from '@tanstack/react-start/server';

export async function consumeRequest(kind:string,limit:number) {
  const secret=process.env['REPORT_INTEGRITY_SECRET'];if(!secret)throw new Error('Request protection is temporarily unavailable.');
  const {integrityIdentity,digest}=await import('./report-integrity.server');const identity=await integrityIdentity(secret);
  const key=await digest(`${kind}:${identity.network}`,secret);
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const result=await supabaseAdmin.rpc('consume_civic_request',{_key:`${kind}:${key}`,_limit:limit});
  if(result.error||!result.data)throw new Error('Too many requests. Please wait a few minutes before trying again.');
}