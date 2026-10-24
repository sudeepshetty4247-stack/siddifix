import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { z } from 'zod';
import { Map, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from '@/lib/location';
import { MAX_SUGGESTED_ACCURACY_METRES } from '@/lib/report-location';
import { NEARBY_RADIUS_METRES } from '@/lib/nearby-cases';
import { Button } from '@/components/ui/button';

const summarySchema = z.object({total:z.number(),active:z.number(),resolved:z.number(),overdue:z.number(),critical:z.number(),radius_m:z.number()});
/** Secondary, compact panel for the selected point. Never shows numbers for a point outside coverage. */
export function NearbyCaseSummary() {
  const { location, setOpen, locating, detect, coverage } = useLocation();
  const point = location ? { lat: location.lat, lng: location.lng } : null;
  const supported = coverage === 'supported' || coverage === 'boundary_review';
  const approximate = location?.method === 'device' && (location.accuracy ?? 0) > MAX_SUGGESTED_ACCURACY_METRES;
  const counts = useQuery({queryKey:['nearby-case-summary',point?.lat,point?.lng],enabled:!!point&&supported,refetchInterval:30000,queryFn:async()=>{
    if (!point) throw new Error('Select a location');
    const result = await supabase.rpc('nearby_case_summary',{_lat:point.lat,_lng:point.lng,_radius_m:NEARBY_RADIUS_METRES});
    if(result.error) throw result.error;
    return summarySchema.parse(result.data);
  }});
  const label = location && location.label !== 'Current location' && !/^[\d.,\s-]+$/.test(location.label) ? location.label : 'your selected location';
  const km = NEARBY_RADIUS_METRES / 1000;
  return <section aria-labelledby="nearby-title" className="mx-auto max-w-7xl px-5 py-6 sm:px-6">
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 id="nearby-title" className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">Around {label}</span></h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{!point ? (locating ? 'Finding your location…' : 'Choose a location to see nearby cases') : coverage === 'checking' ? 'Checking coverage…' : !supported ? 'Outside Siddi\'s Bengaluru service area — no local numbers to show' : `Within ${km} km${approximate ? ` of an approximate point (±${Math.round(location?.accuracy ?? 0)} m)` : ''}`}</p>
      </div>
      {point && supported && <dl className="flex gap-6">
        {[{l:'Active',v:counts.data?.active,t:'text-primary'},{l:'Resolved',v:counts.data?.resolved,t:'text-success'},{l:'Overdue',v:counts.data?.overdue,t:'text-warning-foreground'}].map(i=><div key={i.l}><dt className="text-[11px] text-muted-foreground">{i.l}</dt><dd className={`text-lg font-bold tabular-nums ${i.t}`}>{counts.isPending?'…':counts.isError?'—':i.v}</dd></div>)}
      </dl>}
      <div className="flex shrink-0 gap-2">
        {!point && <Button size="sm" onClick={()=>detect()} disabled={locating}>Use my location</Button>}
        {point && supported && <Button asChild size="sm" variant="ghost"><Link to="/map"><Map className="h-4 w-4" />Map</Link></Button>}
        <Button size="sm" variant="outline" onClick={()=>setOpen(true)}>Change location</Button>
      </div>
    </div>
  </section>;
}
