import { z } from 'zod';

export const integrityConfigSchema = z.object({
  session_limit:z.number().int().min(3).max(100), network_limit:z.number().int().min(10).max(1000),
  user_limit:z.number().int().min(3).max(100), window_minutes:z.number().int().min(1).max(60),
  challenge_after:z.number().int().min(1).max(50), review_threshold:z.number().int().min(10).max(100),
});
export const DEFAULT_INTEGRITY_CONFIG = {session_limit:10,network_limit:60,user_limit:15,window_minutes:10,challenge_after:3,review_threshold:30};
export type IntegrityState = 'unverified'|'pending_review'|'verified'|'information_requested'|'invalid'|'appealed';
export type IntegritySignal = {code:string;points:number;detail:string};
export function explainReportRisk(input:{reusedImage:boolean;repeatedContent:boolean;nearbyDuplicate:boolean;burst:boolean;locationMismatch:boolean;incomplete:boolean}) {
  const signals:IntegritySignal[]=[];
  if(input.reusedImage)signals.push({code:'reused_image',points:30,detail:'Image bytes match earlier evidence; reuse can be legitimate.'});
  if(input.repeatedContent)signals.push({code:'repeated_content',points:25,detail:'Same report details and incident point were submitted recently.'});
  if(input.nearbyDuplicate)signals.push({code:'possible_duplicate',points:15,detail:'A nearby same-category incident may match; staff decide.'});
  if(input.burst)signals.push({code:'submission_burst',points:15,detail:'Several submissions in a short window.'});
  if(input.locationMismatch)signals.push({code:'location_inconsistency',points:20,detail:'Unverified photo/address information differs from the confirmed point.'});
  if(input.incomplete)signals.push({code:'incomplete_details',points:10,detail:'More incident detail may help verification.'});
  return {score:Math.min(100,signals.reduce((n,s)=>n+s.points,0)),signals};
}
export function challengeAnswer(a:number,b:number,answer:string){return /^\d{1,3}$/.test(answer.trim())&&Number(answer)===a+b;}