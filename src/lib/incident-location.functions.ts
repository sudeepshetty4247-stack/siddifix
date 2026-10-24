import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getDirectory } from './directory.functions';
import { incidentCoverage } from './incident-coverage';
export const validateIncidentLocation=createServerFn({method:'POST'})
 .inputValidator((input:{lat:number;lng:number})=>z.object({lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180)}).parse(input))
 .handler(async({data})=>{
   const {routing,status}=incidentCoverage(await getDirectory(),data.lat,data.lng);
   return {status,ward:routing.ward?.name??null,corporation:routing.ward?.corporation??null,checkedAt:new Date().toISOString()};
 });