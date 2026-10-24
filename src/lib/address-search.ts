export type AddressResult = { lat:number; lng:number; label:string; city?:string; state?:string; district?:string };
export function photonResults(input:unknown):AddressResult[] {
  const features=(input as {features?:unknown[]})?.features;
  if(!Array.isArray(features))throw new Error('Invalid location response');
  return features.flatMap(item=>{
    const f=item as {geometry?:{coordinates?:number[]};properties?:Record<string,string>};
    const p=f.properties;const c=f.geometry?.coordinates;
    if(!p||!c||p['countrycode']?.toUpperCase()!=='IN'||!Number.isFinite(c[0])||!Number.isFinite(c[1]))return [];
    return [{lat:c[1] as number,lng:c[0] as number,label:[...new Set([p['name'],p['street'],p['locality'],p['city'],p['district'],p['state'],p['postcode'],p['country']].filter(Boolean))].join(', '),city:p['city'],state:p['state'],district:p['district']}];
  });
}