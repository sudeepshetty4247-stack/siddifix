import {getRequestHeader} from '@tanstack/react-start/server';
import {integrityIdentity,digest} from './report-integrity.server';
import {challengeAnswer} from './report-integrity';
import {z} from 'zod';

export async function protectSubmission(secret:string,phase:'upload'|'submit'|'analysis',challenge?:{token:string;answer:string}) {
  const identity=await integrityIdentity(secret);
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  let user:string|null=null;const authorization=getRequestHeader('authorization');
  if(authorization){const auth=await supabaseAdmin.auth.getUser(authorization.replace(/^Bearer /i,''));if(auth.error||!auth.data.user)throw new Error('Sign-in session is invalid.');user=auth.data.user.id;}
  let nonce:string|undefined;
  if(challenge){
    const [encoded,signature]=challenge.token.split('.');
    if(!encoded||!signature||signature!==await digest(encoded,secret))throw new Error('Verification expired. Please try a new question.');
    let parsed:unknown;try{parsed=JSON.parse(atob(encoded));}catch{throw new Error('Invalid verification.');}
    const payload=z.object({nonce:z.string().uuid(),session:z.string(),expires:z.number(),a:z.number().int().min(1).max(9),b:z.number().int().min(1).max(9)}).parse(parsed);
    if(payload.session!==identity.session||payload.expires<Date.now()||!challengeAnswer(payload.a,payload.b,challenge.answer))throw new Error('Please check the verification answer.');nonce=payload.nonce;
  }
  const result=await supabaseAdmin.rpc('consume_report_limits',{_session:identity.session,_network:identity.network,...(user?{_user:user}:{}),_phase:phase,...(nonce?{_nonce:nonce}:{})});
  if(result.error)throw new Error('Report protection could not be checked. Please try again.');
  const rate=result.data as {allowed:boolean;challenge_required:boolean;hits:number;window_minutes:number};
  if(!rate.allowed)throw new Error(`Please wait ${rate.window_minutes??10} minutes before trying again. Your draft is retained.`);
  if(rate.challenge_required&&!nonce)throw new Error('VERIFICATION_REQUIRED');
  return {...identity,burst:rate.hits>3};
}