import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Camera, LocateFixed, MapPin, Loader2, Layers, FlaskConical, X, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BENGALURU, CATEGORIES, OPEN_STATUSES, categoryById, isOverdue, isInIndia } from '@/lib/civic';
import { useLocation } from '@/lib/location';
import { LazyMap } from './LazyMap';
import { StatusBadge } from './StatusBadge';
import { ISSUE_COLUMNS, type IssueRow } from './IssueCard';
import { Button } from '@/components/ui/button';
import { WardLeaderboard } from './WardLeaderboard';
import { getDirectory } from '@/lib/directory.functions';
import { resolveCivicRouting } from '@/lib/directory';
import { wardPreviewPoint } from '@/lib/bengaluru-map';
import { CivicInfo } from './CivicInfo';
import { WardTestPanel } from './WardTestPanel';

type MapIssue = IssueRow & { duplicate_of: string | null };
export function CitizenMap() {
  const { location, select, detect, locating, notice, setOpen } = useLocation();
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('open');
  const [scope, setScope] = useState('all');
  const [testing, setTesting] = useState(false);
  const [wardPoint, setWardPoint] = useState<{lat: number; lng: number} | null>(null);
  const dir = useQuery({ queryKey: ['civic-directory'], queryFn: () => getDirectory(), staleTime: 300000 });
  const wards = dir.data?.wards ?? [];
  const focusWard = wardPoint && dir.data ? resolveCivicRouting(dir.data, wardPoint.lat, wardPoint.lng).ward : null;
  const [picking, setPicking] = useState(false);
  const [pin, setPin] = useState<{lat: number; lng: number} | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['citizen-map'], refetchInterval: 30000, queryFn: async () => {
    const result = await supabase.from('issues').select(`${ISSUE_COLUMNS}, duplicate_of`).order('created_at', { ascending: false }).limit(1000);
    if (result.error) throw result.error;
    return result.data as MapIssue[];
  }});
  const list = (q.data ?? []).filter(i => (!dir.data || !!resolveCivicRouting(dir.data, i.lat, i.lng).ward) && !i.duplicate_of && (category === 'all' || i.category === category) && (status === 'all' || (status === 'open' ? OPEN_STATUSES.includes(i.status as never) : ['resolved','closed'].includes(i.status))) && (scope === 'all' || !location || Math.abs(i.lat-location.lat) < 0.05 && Math.abs(i.lng-location.lng) < 0.05));
  const active = list.find(i => i.id === selected);
  function confirmPin() {
    if (!pin || !isInIndia(pin.lat,pin.lng)) return;
    select({...pin, method:'manual',label:'Selected report location'});
    setPicking(false);
  }
  return <div className="relative flex min-h-[80dvh] flex-col">
    <div className="border-b bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-5">
        <div><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-primary"><MapPin className="h-3.5 w-3.5" />Bengaluru · Citizen workspace</p><h1 className="text-3xl font-bold sm:text-4xl">Your neighbourhood. Better.</h1><p className="mt-2 text-sm text-muted-foreground">CivicFix · Real reports, local responsibility, visible progress.</p></div>
        <div className="flex flex-wrap gap-2"><Button asChild size="lg"><Link to="/report"><Camera className="h-4 w-4"/>Report a problem<ArrowRight className="h-4 w-4"/></Link></Button><Button variant="outline" onClick={()=>setTesting(!testing)}><FlaskConical className="h-4 w-4"/>Test ward lookup</Button></div>
      </div>
    </div>
    <div className="flex flex-wrap gap-2 border-b bg-background px-4 py-2 sm:px-6">
      <select aria-label="Issue category" className="h-9 min-w-0 max-w-full rounded-lg border bg-card px-2 text-sm" value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select>
      <select aria-label="Issue status" className="h-9 rounded-lg border bg-card px-2 text-sm" value={status} onChange={e=>setStatus(e.target.value)}><option value="open">Open</option><option value="resolved">Resolved</option><option value="all">All statuses</option></select>
      <select aria-label="Map area" className="h-9 rounded-lg border bg-card px-2 text-sm" value={scope} onChange={e=>setScope(e.target.value)}><option value="nearby">Near selected location</option><option value="all">All reports</option></select>
      <Button variant={picking?'default':'outline'} size="sm" onClick={()=>{setPicking(!picking);setPin(null);}}><MapPin className="h-4 w-4"/>Choose report pin</Button>
      <Button variant="outline" size="icon" aria-label="Use current location" disabled={locating} onClick={detect}>{locating?<Loader2 className="h-4 w-4 animate-spin"/>:<LocateFixed className="h-4 w-4"/>}</Button>
    </div>
    {notice && <p role="status" className="bg-warning-soft px-4 py-2 text-sm text-warning-foreground">{notice}</p>}
    <div className="grid flex-1 lg:grid-cols-[1fr_360px]">
      <div className="relative h-[55dvh] min-h-80 lg:h-[70dvh]">
        <LazyMap wards={wards} {...(focusWard ? {selectedWard: focusWard.identifier} : {})} onWardSelect={id=>{const w=wards.find(w=>w.identifier===id); const p=w?wardPreviewPoint(w):null; if(p){setWardPoint(p);setTesting(false);setSelected(null);}}} center={BENGALURU} zoom={13} recenter={pin??wardPoint} picked={picking?pin:wardPoint} {...(picking ? {onPick:(lat:number,lng:number)=>setPin({lat,lng})} : {})} markers={list.map(i=>({id:i.id,lat:i.lat,lng:i.lng,tone:['resolved','closed'].includes(i.status)?'resolved':i.severity==='critical'?'critical':isOverdue(i)?'overdue':'open',label:i.title,sub:`${categoryById(i.category).label} · ${i.ref_code}`,href:`/issues/${i.ref_code}`}))} onSelect={setSelected}/>
        <div className="pointer-events-none absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-lg border bg-card/95 px-3 py-2 text-xs shadow-soft"><Layers className="h-4 w-4 text-primary" />{wards.length ? `${wards.length} GBA wards · Bengaluru` : 'Loading Bengaluru boundaries…'}</div>
        {picking && <div className="absolute inset-x-3 bottom-4 z-[500] border bg-card p-3 shadow-soft"><p className="text-sm font-semibold">{pin?`${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`:'Place the problem location on the map'}</p>{pin&&!isInIndia(pin.lat,pin.lng)&&<p role="alert" className="text-xs text-destructive">Choose a location within India.</p>}<div className="mt-2 flex gap-2"><Button disabled={!pin||!isInIndia(pin.lat,pin.lng)} onClick={confirmPin}>Confirm location</Button><Button variant="ghost" onClick={()=>setPicking(false)}>Cancel</Button></div></div>}
      </div>
      <aside className="max-h-[70dvh] overflow-y-auto border-t bg-card lg:border-l lg:border-t-0">
        <div className="border-b p-4"><h2 className="font-semibold">{scope==='nearby'?'Nearby issues':'Reported issues'}</h2><p className="mt-1 text-xs text-muted-foreground">{q.isLoading?'Loading reports…':`${list.length} underlying issues in this view`}</p><div className="mt-3 flex flex-wrap gap-3 text-xs"><span className="text-primary">● Open</span><span className="text-warning-foreground">● Overdue</span><span className="text-destructive">● Critical</span><span className="text-success">● Resolved</span></div></div>
        {q.isError?<div role="alert" className="p-4"><p>Reports could not be loaded.</p><Button variant="outline" onClick={()=>q.refetch()}>Retry</Button></div>:!q.isLoading&&!list.length?<div className="space-y-3 p-4"><h3 className="font-semibold">No matching CivicFix reports yet</h3><p className="text-sm text-muted-foreground">No real submissions match this area and these filters.</p>{!location&&<Button variant="outline" onClick={()=>setOpen(true)}>Choose location</Button>}<Button asChild className="w-full"><Link to="/report"><Camera className="h-4 w-4"/>Report a Problem</Link></Button></div>:null}
        {active && <section className="space-y-3 border-b bg-primary-soft p-4"><StatusBadge status={active.status}/><h3 className="font-semibold">{active.title}</h3>{active.photo_url&&<img src={active.photo_url} alt={active.title} className="aspect-video w-full rounded-lg object-cover"/>}<Button asChild><Link to="/issues/$ref" params={{ref:active.ref_code}}>View issue and history</Link></Button></section>}
        {list.map(i=><Link key={i.id} to="/issues/$ref" params={{ref:i.ref_code}} className="flex gap-3 border-b p-4 hover:bg-secondary">{i.photo_url&&<img src={i.photo_url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" loading="lazy"/>}<div className="min-w-0 space-y-1"><h3 className="line-clamp-2 text-sm font-semibold">{i.title}</h3><p className="font-mono text-xs text-muted-foreground">{i.ref_code}</p><StatusBadge status={i.status}/></div></Link>)}
        {(q.data?.length??0)>=1000&&<p className="p-4 text-xs text-muted-foreground">Showing the latest 1,000 reports; not a city-wide total.</p>}
        <WardLeaderboard />
      </aside>
    </div>
  </div>;
}
