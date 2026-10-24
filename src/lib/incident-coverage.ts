import { resolveCivicRouting, type Directory } from './directory';
export function incidentCoverage(directory:Directory,lat:number,lng:number) {
 const routing=resolveCivicRouting(directory,lat,lng);
 const status=routing.ward&&routing.coverage?'supported' as const:routing.reviewReason?.startsWith('This pin touches')?'unknown' as const:'outside' as const;
 return {routing,status};
}