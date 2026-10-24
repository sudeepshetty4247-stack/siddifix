import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getDirectory } from './directory.functions';
import { resolveCivicRouting } from './directory';
export const validateIncidentLocation=createServerFn({method:'POST'})
 .inputValidator((input:{lat:number;lng:number})=>z.object({lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180)}).parse(input))
 .handler(async({data})=>{
   const routing=resolveCivicRouting(await getDirectory(),data.lat,data.lng);
   return {status:routing.ward&&routing.coverage?'supported' as const:routing.reviewReason?.startsWith('This pin touches')?'unknown' as const:'outside' as const,ward:routing.ward?.name??null,corporation:routing.ward?.corporation??null,checkedAt:new Date().toISOString()};
 });