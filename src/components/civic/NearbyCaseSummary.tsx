import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { MapPin, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from '@/lib/location';
import { MAX_SUGGESTED_ACCURACY_METRES } from '@/lib/report-location';
import { NEARBY_RADIUS_METRES } from '@/lib/nearby-cases';
import { getDirectory } from '@/lib/directory.functions';
import { resolveCivicRouting } from '@/lib/directory';
import { Button } from '@/components/ui/button';

const summarySchema = z.object({total:z.number(),active:z.number(),resolved:z.number(),overdue:z.number(),critical:z.number(),radius_m:z.number()});
export function NearbyCaseSummary() {
  const { location, setOpen, locating, detect } = useLocation();
  // Browsing counts use the best known point, even a rough GPS fix; the 100 m rule only gates report submission.
  const point = location ? { lat: location.lat, lng: location.lng } : null;
  const approximate = location?.method === 'device' && (location.accuracy ?? 0) > MAX_SUGGESTED_ACCURACY_METRES;
  const directory = useQuery({queryKey:['civic-directory'],queryFn:()=>getDirectory(),staleTime:300000});
  const ward = point && directory.data ? resolveCivicRouting(directory.data,point.lat,point.lng).ward : null;
  const counts = useQuery({queryKey:['nearby-case-summary',point?.lat,point?.lng],enabled:!!point,refetchInterval:15000,queryFn:async()=>{
    if (!point) throw new Error('Select a location');
    const result = await supabase.rpc('nearby_case_summary',{_lat:point.lat,_lng:point.lng,_radius_m:NEARBY_RADIUS_METRES});
    if(result.error) throw result.error;
    return summarySchema.parse(result.data);
  }});
  const label = location && location.label !== 'Current location' && location.label !== 'Selected report location' && !/^[\d.,\s-]+$/.test(location.label) ? location.label : 'Your neighbourhood';
  return <section aria-label="Nearby case summary" className="border-b bg-primary-soft">
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-semibold"><MapPin className="h-4 w-4 text-primary" />{label}</h2><p className="mt-1 text-xs text-muted-foreground">{point ? `Within 2 km of your ${approximate ? `approximate point (±${Math.round(location?.accuracy ?? 0)} m)` : 'selected point'}${ward ? ` · Ward ${ward.ward_number} ${ward.name}` : ''}` : locating ? 'Finding your location…' : 'Select your location for local case totals'}</p></div>{point ? <div className="flex items-center gap-2"><Button size="icon" variant="ghost" aria-label="Refresh nearby case totals" disabled={counts.isFetching} onClick={()=>counts.refetch()}><RefreshCw className={`h-4 w-4 ${counts.isFetching?'animate-spin':''}`} /></Button><Button variant="outline" size="sm" onClick={()=>setOpen(true)}>Change</Button></div> : <div className="flex items-center gap-2"><Button onClick={()=>detect()} disabled={locating}>{locating ? 'Finding you…' : 'Use my current location'}</Button><Button variant="outline" onClick={()=>setOpen(true)}>Choose on map</Button></div>}</div>
      {point && (counts.isPending ? <p role="status" className="mt-4 text-sm">Loading nearby cases…</p> : counts.isError ? <p role="alert" className="mt-4 text-sm">Nearby totals couldn't be loaded. Try refreshing.</p> : <><dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">{[{label:'Active cases',value:counts.data.active,tone:'text-primary'},{label:'Resolved cases',value:counts.data.resolved,tone:'text-success'},{label:'Overdue cases',value:counts.data.overdue,tone:'text-warning-foreground'},{label:'Critical active',value:counts.data.critical,tone:'text-destructive'}].map(item=><div key={item.label}><dt className="text-xs text-muted-foreground">{item.label}</dt><dd className={`mt-1 text-2xl font-bold tabular-nums ${item.tone}`}>{item.value}</dd></div>)}</dl><p role="status" className="mt-3 text-xs text-muted-foreground">{counts.data.total === 0 ? 'No Siddi cases recorded within 2 km yet.' : `${counts.data.total} unique Siddi cases within 2 km.`} Totals refresh every 15 seconds; merged reports count once.</p></>)}
    </div>
  </section>;
}