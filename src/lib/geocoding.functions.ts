import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

// Hosted Nominatim only: the donated public endpoint is not a production service.
export const reverseGeocode = createServerFn({ method: 'POST' })
  .inputValidator((input: { lat: number; lng: number }) => z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(input))
  .handler(async ({ data }) => {
    const endpoint = process.env['CIVICFIX_NOMINATIM_URL'];
    if (!endpoint) return { address: null, sourceUrl: null, checkedAt: null, notice: 'Street address lookup is not connected. Ward matching uses your confirmed pin; staff can review missing details.' };
    const url = new URL('reverse', endpoint.endsWith('/') ? endpoint : `${endpoint}/`);
    if (url.protocol !== 'https:' || url.hostname === 'nominatim.openstreetmap.org') return { address: null, sourceUrl: null, checkedAt: null, notice: 'A hosted address service is required. Your confirmed pin remains usable.' };
    url.search = new URLSearchParams({ lat: String(data.lat), lon: String(data.lng), format: 'jsonv2', zoom: '18', addressdetails: '1' }).toString();
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) return { address: null, sourceUrl: null, checkedAt: null, notice: `Address lookup unavailable (${response.status}). Your report can still be submitted.` };
      const result = z.object({ display_name: z.string().max(1000).optional() }).parse(await response.json());
      return { address: result.display_name ?? null, sourceUrl: 'https://www.openstreetmap.org/copyright', checkedAt: new Date().toISOString(), notice: result.display_name ? null : 'No street address found. Ward matching still uses the confirmed coordinates.' };
    } catch {
      return { address: null, sourceUrl: null, checkedAt: null, notice: 'Address lookup is unavailable. Your report can still be submitted.' };
    }
  });

export const searchAddress=createServerFn({method:'POST'})
  .inputValidator((input:{query:string})=>z.object({query:z.string().trim().min(3).max(160)}).parse(input))
  .handler(async({data})=>{
    const endpoint=process.env['CIVICFIX_NOMINATIM_URL'];
    const empty={results:[] as {lat:number;lng:number;label:string}[],notice:'Address search is not connected. Choose a map pin instead.'};
    if(!endpoint)return empty;
    const url=new URL('search',endpoint.endsWith('/')?endpoint:`${endpoint}/`);
    if(url.protocol!=='https:'||url.hostname==='nominatim.openstreetmap.org')return empty;
    url.search=new URLSearchParams({q:data.query,format:'jsonv2',limit:'5',countrycodes:'in'}).toString();
    try{const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)return {...empty,notice:'Address search is unavailable. Choose a map pin instead.'};
      const rows=z.array(z.object({lat:z.string(),lon:z.string(),display_name:z.string().max(1000)})).parse(await r.json());
      return {results:rows.map(row=>({lat:Number(row.lat),lng:Number(row.lon),label:row.display_name})).filter(row=>Number.isFinite(row.lat)&&Number.isFinite(row.lng)),notice:null};
    }catch{return empty;}
  });