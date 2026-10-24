import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Camera, LocateFixed, MapPin, Loader2, X, List, Map as MapIcon, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BENGALURU, CATEGORIES, OPEN_STATUSES, categoryById, isOverdue, isInIndia, SEVERITY_META, type Severity } from '@/lib/civic';
import { useLocation } from '@/lib/location';
import { LazyMap } from './LazyMap';
import { StatusBadge } from './StatusBadge';
import { type IssueRow } from './IssueCard';
import { Button } from '@/components/ui/button';
import { getDirectory } from '@/lib/directory.functions';
import { resolveCivicRouting, type Ward } from '@/lib/directory';
import { citizenMapFocus } from '@/lib/map-location';
import { suggestedReportLocation } from '@/lib/report-location';
import { CivicInfo } from './CivicInfo';
import { distanceMetres, NEARBY_RADIUS_METRES } from '@/lib/nearby-cases';
import { publicCases } from '@/lib/public-cases';
import { wardPreviewPoint } from '@/lib/bengaluru-map';
import type { WardCount } from '@/lib/wards';

type MapIssue = IssueRow & { duplicate_of: string | null };

export function CitizenMap() {
  const { location, select, detect, locating, notice, setOpen } = useLocation();
  const [category, setCategory] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [status, setStatus] = useState('open');
  const [scope, setScope] = useState('all');
  const [mode, setMode] = useState<'map' | 'list'>('map');
  const [wardId, setWardId] = useState<string | null>(null);
  const [wardPoint, setWardPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [picking, setPicking] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const dir = useQuery({ queryKey: ['civic-directory'], queryFn: () => getDirectory(), staleTime: 300000 });
  const wards = dir.data?.wards ?? [];
  const wardCounts = useQuery({
    queryKey: ['ward-case-counts'], refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ward_case_counts');
      if (error) throw error;
      return (data ?? []).map(r => ({ ...r, reports: Number(r.reports), unique_issues: Number(r.unique_issues), unresolved: Number(r.unresolved), resolved: Number(r.resolved) })) as WardCount[];
    },
  });

  const locationFocus = citizenMapFocus(dir.data, location);
  const detailPoint = wardPoint ?? locationFocus;
  const focusWard = detailPoint && dir.data ? resolveCivicRouting(dir.data, detailPoint.lat, detailPoint.lng).ward : null;
  const reliableLocation = suggestedReportLocation(location);
  const outsideCoverage = !!dir.data && !!reliableLocation && !locationFocus;

  useEffect(() => { setWardPoint(null); setWardId(null); setPin(null); setSelected(null); }, [location?.lat, location?.lng]);

  const q = useQuery({ queryKey: ['citizen-map'], refetchInterval: 30000, queryFn: async () => (await publicCases()) as MapIssue[] });

  const list = useMemo(() => (q.data ?? []).filter(i =>
    (!dir.data || !!resolveCivicRouting(dir.data, i.lat, i.lng).ward) &&
    !i.duplicate_of &&
    (category === 'all' || i.category === category) &&
    (severity === 'all' || i.severity === severity) &&
    (status === 'all' || (status === 'open' ? OPEN_STATUSES.includes(i.status as never) : ['resolved', 'closed'].includes(i.status))) &&
    (scope === 'all' || !reliableLocation || distanceMetres(reliableLocation, i) <= NEARBY_RADIUS_METRES) &&
    (!wardId || !dir.data || resolveCivicRouting(dir.data, i.lat, i.lng).ward?.identifier === wardId)
  ), [q.data, dir.data, category, severity, status, scope, reliableLocation, wardId]);

  const activeCount = list.filter(i => OPEN_STATUSES.includes(i.status as never)).length;
  const selectedIssue = list.find(i => i.id === selected);
  const selectedWard = wardId ? wards.find(w => w.identifier === wardId) ?? null : null;
  const selectedWardCount = wardId ? wardCounts.data?.find(c => c.ward_identifier === wardId) : null;

  const countMarkers = useMemo(() => {
    if (!wards.length || !wardCounts.data) return [];
    const byWard = new Map(wardCounts.data.map(c => [c.ward_identifier, c]));
    return wards.flatMap(w => {
      const c = byWard.get(w.identifier);
      if (!c || c.reports === 0) return [];
      const point = wardPreviewPoint(w);
      return point ? [{ id: w.identifier, lat: point.lat, lng: point.lng, count: c.reports, label: `${w.name} · #${w.ward_number ?? ''}` }] : [];
    });
  }, [wards, wardCounts.data]);

  function confirmPin() {
    if (!pin || !isInIndia(pin.lat, pin.lng)) return;
    select({ ...pin, method: 'manual', label: 'Selected report location' });
    setPicking(false);
  }
  function pickWard(id: string) {
    const ward = wards.find(w => w.identifier === id);
    const point = ward ? wardPreviewPoint(ward) : null;
    setWardId(id);
    if (point) setWardPoint(point);
    setSelected(null);
  }

  const filterSelect = 'h-9 min-w-0 rounded-full border bg-card/95 px-3 text-xs font-medium shadow-soft backdrop-blur';
  return (
    <div className="relative flex flex-col">
      {notice && <p role="status" className="bg-warning-soft px-4 py-2 text-sm text-warning-foreground">{notice}</p>}
      {outsideCoverage && <p role="status" className="bg-warning-soft px-4 py-2 text-sm text-warning-foreground">CivicFix is growing! We're not fully connected to your area yet — the map stays in Bengaluru, and your location has not been moved.</p>}

      <div className="relative h-[calc(100dvh-10.5rem)] min-h-[26rem] w-full">
        {mode === 'map' ? (
          <LazyMap
            wards={wards}
            {...(focusWard ? { selectedWard: focusWard.identifier } : {})}
            {...(!picking ? { onWardSelect: (id: string, point: { lat: number; lng: number }) => { setWardId(id); setWardPoint(point); setSelected(null); } } : {})}
            center={locationFocus ?? BENGALURU}
            zoom={locationFocus ? 15 : 12}
            recenter={pin ? { ...pin, zoom: 16 } : detailPoint ? { ...detailPoint, zoom: 15 } : null}
            picked={picking ? pin : detailPoint}
            {...(picking ? { onPick: (lat: number, lng: number) => setPin({ lat, lng }) } : {})}
            counts={countMarkers}
            onCountSelect={pickWard}
            markers={list.map(i => ({ id: i.id, lat: i.lat, lng: i.lng, tone: ['resolved', 'closed'].includes(i.status) ? 'resolved' : i.severity === 'critical' ? 'critical' : isOverdue(i) ? 'overdue' : 'open', label: i.title, sub: `${categoryById(i.category).label} · ${i.ref_code}`, href: `/issues/${i.ref_code}` }))}
            onSelect={setSelected}
          />
        ) : (
          <div className="h-full overflow-y-auto bg-background">
            {q.isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading reports…</p>
              : q.isError ? <div role="alert" className="p-6"><p>Reports could not be loaded.</p><Button variant="outline" className="mt-2" onClick={() => q.refetch()}>Retry</Button></div>
              : !list.length ? <div className="space-y-3 p-6 text-center"><h2 className="font-semibold">No matching CivicFix reports yet</h2><p className="text-sm text-muted-foreground">No real submissions match this area and these filters.</p><Button asChild><Link to="/report"><Camera className="h-4 w-4" />Report a Problem</Link></Button></div>
              : list.map(i => (
                <Link key={i.id} to="/issues/$ref" params={{ ref: i.ref_code }} className="flex gap-3 border-b p-4 hover:bg-secondary">
                  {i.photo_url && <img src={i.photo_url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" loading="lazy" />}
                  <div className="min-w-0 space-y-1">
                    <h3 className="line-clamp-2 text-sm font-semibold">{i.title}</h3>
                    <p className="text-xs text-muted-foreground">{categoryById(i.category).label} · {i.ref_code}</p>
                    <StatusBadge status={i.status} />
                  </div>
                </Link>
              ))}
          </div>
        )}

        {/* Floating count pill */}
        <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border bg-card/95 px-4 py-2 shadow-lift backdrop-blur">
            <span className="text-sm"><b className="text-destructive">{activeCount}</b> <span className="text-muted-foreground">Active</span></span>
            <span className="h-4 w-px bg-border" />
            <span className="text-sm"><b>{list.length}</b> <span className="text-muted-foreground">Reports</span></span>
          </div>
        </div>

        {/* Filters */}
        <div className="absolute left-3 top-16 z-[500] flex max-w-[calc(100%-7rem)] flex-wrap gap-2">
          <select aria-label="Severity" className={filterSelect} value={severity} onChange={e => setSeverity(e.target.value)}>
            <option value="all">All Severity</option>
            {(Object.keys(SEVERITY_META) as Severity[]).map(s => <option key={s} value={s}>{SEVERITY_META[s].label}</option>)}
          </select>
          <select aria-label="Status" className={filterSelect} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="open">Unresolved</option><option value="resolved">Resolved</option><option value="all">All Status</option>
          </select>
          <select aria-label="Category" className={filterSelect} value={category} onChange={e => setCategory(e.target.value)}>
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select aria-label="Map area" className={filterSelect} value={scope} onChange={e => setScope(e.target.value)}>
            <option value="all">All Bengaluru</option><option value="nearby">Within 2 km</option>
          </select>
        </div>

        {/* Map/List toggle + locate */}
        <div className="absolute right-3 top-16 z-[500] flex flex-col gap-2">
          <div className="flex rounded-full border bg-card/95 p-0.5 shadow-soft backdrop-blur" role="group" aria-label="View mode">
            <button onClick={() => setMode('map')} aria-pressed={mode === 'map'} className={`flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold ${mode === 'map' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}><MapIcon className="h-3.5 w-3.5" />Map</button>
            <button onClick={() => setMode('list')} aria-pressed={mode === 'list'} className={`flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold ${mode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}><List className="h-3.5 w-3.5" />List</button>
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9 self-end rounded-full bg-card/95 shadow-soft" aria-label="Use current location" disabled={locating} onClick={detect}>
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          </Button>
        </div>

        {/* Ward bottom sheet */}
        {selectedWard && mode === 'map' && !picking && (
          <div className="absolute inset-x-3 bottom-20 z-[500] max-h-[45%] overflow-y-auto rounded-2xl border bg-card p-4 shadow-lift sm:left-auto sm:w-96">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold">{selectedWard.name} <span className="text-muted-foreground">#{selectedWard.ward_number}</span></h2>
                <p className="text-xs text-muted-foreground">{selectedWard.corporation.replace('Bengaluru ', '').replace(' City Corporation', '')}{selectedWard.zone ? ` · ${selectedWard.zone} zone` : ''}</p>
              </div>
              <Button size="icon" variant="ghost" aria-label="Close ward details" onClick={() => { setWardId(null); setWardPoint(null); }}><X className="h-4 w-4" /></Button>
            </div>
            {selectedWardCount && (
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="rounded-lg bg-muted p-2"><b className="block text-base">{selectedWardCount.reports}</b>Reports</div>
                <div className="rounded-lg bg-warning/10 p-2"><b className="block text-base">{selectedWardCount.unresolved}</b>Unresolved</div>
                <div className="rounded-lg bg-success/10 p-2"><b className="block text-base">{selectedWardCount.resolved}</b>Resolved</div>
              </div>
            )}
            <div className="mt-3"><CivicInfo lat={wardPoint?.lat ?? locationFocus?.lat ?? BENGALURU.lat} lng={wardPoint?.lng ?? locationFocus?.lng ?? BENGALURU.lng} {...(category !== 'all' ? { category } : {})} /></div>
          </div>
        )}

        {/* Selected issue card */}
        {selectedIssue && mode === 'map' && !picking && (
          <div className="absolute inset-x-3 bottom-20 z-[500] rounded-2xl border bg-card p-4 shadow-lift sm:left-auto sm:w-96">
            <div className="flex items-start justify-between gap-2">
              <StatusBadge status={selectedIssue.status} />
              <Button size="icon" variant="ghost" aria-label="Close issue preview" onClick={() => setSelected(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="mt-2 flex gap-3">
              {selectedIssue.photo_url && <img src={selectedIssue.photo_url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />}
              <div className="min-w-0">
                <h3 className="line-clamp-2 text-sm font-semibold">{selectedIssue.title}</h3>
                <p className="text-xs text-muted-foreground">{categoryById(selectedIssue.category).label} · {selectedIssue.ref_code}</p>
              </div>
            </div>
            <Button asChild className="mt-3 w-full"><Link to="/issues/$ref" params={{ ref: selectedIssue.ref_code }}>View issue and history<ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        )}

        {/* Pin picking */}
        {picking && mode === 'map' && (
          <div className="absolute inset-x-3 bottom-20 z-[500] rounded-2xl border bg-card p-3 shadow-lift">
            <p className="text-sm font-semibold">{pin ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : 'Tap the map to place the problem location'}</p>
            {pin && !isInIndia(pin.lat, pin.lng) && <p role="alert" className="text-xs text-destructive">Choose a location within India.</p>}
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={!pin || !isInIndia(pin.lat, pin.lng)} onClick={confirmPin}>Confirm location</Button>
              <Button size="sm" variant="ghost" onClick={() => setPicking(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Bottom action bar */}
        <div className="absolute inset-x-0 bottom-4 z-[500] flex justify-center gap-2 px-4">
          <Button variant={picking ? 'default' : 'outline'} className="rounded-full bg-card/95 shadow-lift" onClick={() => { setPicking(!picking); setPin(null); }}>
            <MapPin className="h-4 w-4" />{picking ? 'Placing pin…' : 'Choose pin'}
          </Button>
          <Button asChild size="lg" className="rounded-full shadow-lift">
            <Link to="/report"><Camera className="h-4 w-4" />Report a Problem</Link>
          </Button>
        </div>
      </div>

      {location && <p className="border-t px-4 py-2 text-xs text-muted-foreground">Selected location: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}{location.method === 'device' ? ` · Device estimate ±${Math.round(location.accuracy ?? 0)} m` : ' · Manual pin'}{!location && !reliableLocation ? '' : ''}</p>}
      {!location && <p className="border-t px-4 py-2 text-xs text-muted-foreground">Showing all of Bengaluru. <button className="font-medium text-primary underline" onClick={() => setOpen(true)}>Choose your location</button> for nearby reports.</p>}
    </div>
  );
}
