import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, LocateFixed, Loader2, X, ArrowRight, ChevronDown, Search, BarChart3, MapPinOff, Info } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { BENGALURU, CATEGORIES, OPEN_STATUSES, categoryById, isOverdue, SEVERITY_META, type Severity } from '@/lib/civic';
import { useLocation } from '@/lib/location';
import { useLiveGps } from '@/lib/live-gps';
import { LazyMap } from './LazyMap';
import { StatusBadge } from './StatusBadge';
import { type IssueRow } from './IssueCard';
import { Button } from '@/components/ui/button';
import { getDirectory } from '@/lib/directory.functions';
import { pointInGeometry, type Ward } from '@/lib/directory';
import { citizenMapFocus, corporationShort, describeLiveFix } from '@/lib/map-location';
import { CivicInfo } from './CivicInfo';
import { NEARBY_RADIUS_METRES } from '@/lib/nearby-cases';
import { publicCases } from '@/lib/public-cases';
import { wardPreviewPoint } from '@/lib/bengaluru-map';
import type { WardCount } from '@/lib/wards';

type MapIssue = IssueRow & { duplicate_of: string | null };
type Fly = { lat: number; lng: number; zoom: number; nonce: number };
const nearbySchema = z.object({ total: z.number(), active: z.number(), resolved: z.number(), overdue: z.number(), critical: z.number() });

export function CitizenMap() {
  const { location, select } = useLocation();
  const gps = useLiveGps(true);
  const [category, setCategory] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [status, setStatus] = useState('open');
  const [mode, setMode] = useState<'map' | 'list'>('map');
  const [tappedWard, setTappedWard] = useState<{ id: string; lat: number; lng: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [fly, setFly] = useState<Fly | null>(null);
  const [details, setDetails] = useState(false);
  const [wardSearch, setWardSearch] = useState('');
  const [openRow, setOpenRow] = useState<string | null>(null);
  const flewToFix = useRef(false);
  const sharedOnce = useRef(false);

  const dir = useQuery({ queryKey: ['civic-directory'], queryFn: () => getDirectory(), staleTime: 300000 });
  const wards = dir.data?.wards ?? [];
  const wardCounts = useQuery({
    queryKey: ['ward-case-counts'], refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ward_case_counts');
      if (error) throw error;
      return (data ?? []).map(r => ({ ...r, reports: Number(r.reports), unique_issues: Number(r.unique_issues), unresolved: Number(r.unresolved), resolved: Number(r.resolved) })) as WardCount[];
    },
  });
  const countByWard = useMemo(() => new Map((wardCounts.data ?? []).map(c => [c.ward_identifier, c])), [wardCounts.data]);

  // Where the device is right now, against the published ward boundaries.
  const place = describeLiveFix(dir.data, gps.fix);
  const savedFocus = citizenMapFocus(dir.data, location);
  const savedWard = savedFocus ? wards.find(w => w.active && pointInGeometry(savedFocus.lat, savedFocus.lng, w.boundary)) ?? null : null;
  const yourWard = place?.kind === 'ward' ? place.ward : null;
  const youPoint = gps.fix && place && place.kind !== 'outside' ? gps.fix : null;

  // Fly to the first live fix inside Bengaluru, like a maps app.
  useEffect(() => {
    if (!gps.fix || !place || flewToFix.current) return;
    if (place.kind === 'outside') return;
    flewToFix.current = true;
    setFly({ lat: gps.fix.lat, lng: gps.fix.lng, zoom: place.precise ? 16 : 14, nonce: Date.now() });
    // Never silently replace a manually chosen place or the explicit demo point with GPS.
    if (place.precise && !sharedOnce.current && (!location || location.method === 'device')) {
      sharedOnce.current = true;
      select({ lat: gps.fix.lat, lng: gps.fix.lng, label: 'Current location', method: 'device', accuracy: gps.fix.accuracy });
    }
  }, [gps.fix, place, select]);
  // Without live GPS, fall back to the person's saved location.
  useEffect(() => {
    if (flewToFix.current || !savedFocus || (gps.state !== 'denied' && gps.state !== 'unavailable')) return;
    flewToFix.current = true;
    setFly({ ...savedFocus, zoom: 15, nonce: Date.now() });
  }, [gps.state, savedFocus?.lat, savedFocus?.lng]);

  const q = useQuery({ queryKey: ['citizen-map'], refetchInterval: 30000, queryFn: async () => (await publicCases()) as MapIssue[] });
  const issueWard = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const i of q.data ?? []) m.set(i.id, wards.find(w => w.active && pointInGeometry(i.lat, i.lng, w.boundary))?.identifier ?? null);
    return m;
  }, [q.data, wards]);

  const list = useMemo(() => (q.data ?? []).filter(i =>
    (!wards.length || !!issueWard.get(i.id)) &&
    !i.duplicate_of &&
    (category === 'all' || i.category === category) &&
    (severity === 'all' || i.severity === severity) &&
    (status === 'all' || (status === 'open' ? OPEN_STATUSES.includes(i.status as never) : ['resolved', 'closed'].includes(i.status)))
  ), [q.data, wards.length, issueWard, category, severity, status]);

  const allCanonical = (q.data ?? []).filter(i => !i.duplicate_of && (!wards.length || !!issueWard.get(i.id)));
  const activeTotal = allCanonical.filter(i => OPEN_STATUSES.includes(i.status as never)).length;
  const selectedIssue = list.find(i => i.id === selected);

  // Ward card: a tapped ward wins, otherwise the ward you are standing in, otherwise your saved spot.
  const cardWard: Ward | null = tappedWard ? wards.find(w => w.identifier === tappedWard.id) ?? null : yourWard ?? savedWard;
  const cardPoint = tappedWard ?? (yourWard && gps.fix ? gps.fix : savedWard ? savedFocus : null);
  const cardKind = tappedWard ? 'tapped' : yourWard ? (place?.kind === 'ward' && place.precise ? 'here' : 'near') : savedWard ? 'saved' : null;
  const cardCount = cardWard ? countByWard.get(cardWard.identifier) : undefined;

  const nearbyPoint = youPoint ?? savedFocus;
  const nearby = useQuery({
    queryKey: ['nearby-case-summary', nearbyPoint && Math.round(nearbyPoint.lat * 2000), nearbyPoint && Math.round(nearbyPoint.lng * 2000)],
    enabled: !!nearbyPoint, refetchInterval: 15000,
    queryFn: async () => {
      if (!nearbyPoint) throw new Error('No location');
      const r = await supabase.rpc('nearby_case_summary', { _lat: nearbyPoint.lat, _lng: nearbyPoint.lng, _radius_m: NEARBY_RADIUS_METRES });
      if (r.error) throw r.error;
      return nearbySchema.parse(r.data);
    },
  });

  const countMarkers = useMemo(() => wards.flatMap(w => {
    const n = list.filter(i => issueWard.get(i.id) === w.identifier).length;
    if (!n) return [];
    const point = wardPreviewPoint(w);
    return point ? [{ id: w.identifier, lat: point.lat, lng: point.lng, count: n, label: `${w.name} · #${w.ward_number ?? ''}` }] : [];
  }), [wards, list, issueWard]);

  function focusWard(id: string, point?: { lat: number; lng: number }) {
    const ward = wards.find(w => w.identifier === id);
    const p = point ?? (ward ? wardPreviewPoint(ward) : null);
    if (!p) return;
    setTappedWard({ id, ...p }); setSelected(null); setDetails(false);
    if (!point) setFly({ ...p, zoom: 15, nonce: Date.now() });
  }
  function locate() {
    setTappedWard(null); setDetails(false);
    if (gps.fix && place && place.kind !== 'outside') setFly({ lat: gps.fix.lat, lng: gps.fix.lng, zoom: place.precise ? 16 : 14, nonce: Date.now() });
    else flewToFix.current = false;
    gps.start();
  }

  const wardRows = useMemo(() => {
    const s = wardSearch.trim().toLowerCase();
    return wards
      .filter(w => w.active && (s ? `${w.name} ${w.ward_number ?? ''} ${w.zone ?? ''} ${w.assembly ?? ''}`.toLowerCase().includes(s) : (countByWard.get(w.identifier)?.reports ?? 0) > 0))
      .map(w => ({ w, c: countByWard.get(w.identifier) }))
      .sort((a, b) => (b.c?.reports ?? 0) - (a.c?.reports ?? 0) || a.w.name.localeCompare(b.w.name))
      .slice(0, 80);
  }, [wards, wardSearch, countByWard]);

  const status_pill =
    gps.state === 'locating' && !gps.fix ? { icon: <Loader2 className="h-4 w-4 animate-spin text-primary" />, text: 'Locating you on the map…' }
    : gps.state === 'denied' ? { icon: <MapPinOff className="h-4 w-4 text-warning-foreground" />, text: 'Location is off. Allow it in your browser, or tap a ward.' }
    : gps.state === 'unavailable' && !gps.fix ? { icon: <MapPinOff className="h-4 w-4 text-warning-foreground" />, text: 'Couldn’t find your location. Tap ◎ to try again.' }
    : place?.kind === 'outside' ? { icon: <Info className="h-4 w-4 text-warning-foreground" />, text: 'You’re outside Bengaluru. Showing the city.' }
    : place?.kind === 'boundary' ? { icon: <Info className="h-4 w-4 text-warning-foreground" />, text: 'You’re on a ward border. Tap your ward to choose.' }
    : null;

  const sel = 'h-9 min-w-0 rounded-lg border bg-card px-2.5 text-xs font-medium';
  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[30rem] flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b bg-card px-3 py-2">
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
          <select aria-label="Severity" className={sel} value={severity} onChange={e => setSeverity(e.target.value)}>
            <option value="all">All Severity</option>
            {(Object.keys(SEVERITY_META) as Severity[]).map(s => <option key={s} value={s}>{SEVERITY_META[s].label}</option>)}
          </select>
          <select aria-label="Status" className={sel} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="open">Unresolved</option><option value="resolved">Resolved</option><option value="all">All Status</option>
          </select>
          <select aria-label="Category" className={sel} value={category} onChange={e => setCategory(e.target.value)}>
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div className="flex shrink-0 rounded-lg border bg-muted p-0.5" role="group" aria-label="View mode">
          {(['map', 'list'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className={`h-8 rounded-md px-3 text-xs font-semibold capitalize ${mode === m ? 'bg-card shadow-soft' : 'text-muted-foreground'}`}>{m}</button>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {mode === 'map' ? (
          <LazyMap
            wards={wards}
            {...(yourWard && !tappedWard ? { highlightWard: yourWard.identifier } : {})}
            {...(tappedWard ? { selectedWard: tappedWard.id } : {})}
            onWardSelect={(id, point) => focusWard(id, point)}
            center={BENGALURU}
            zoom={12}
            recenter={fly}
            you={youPoint}
            clusterBelowZoom={14}
            counts={countMarkers}
            onCountSelect={id => focusWard(id)}
            markers={list.map(i => ({ id: i.id, lat: i.lat, lng: i.lng, tone: ['resolved', 'closed'].includes(i.status) ? 'resolved' : i.severity === 'critical' ? 'critical' : isOverdue(i) ? 'overdue' : 'open', label: i.title, sub: `${categoryById(i.category).label} · ${i.ref_code}`, href: `/issues/${i.ref_code}` }))}
            onSelect={id => { setSelected(id); setDetails(false); }}
          />
        ) : (
          <div className="h-full overflow-y-auto bg-background">
            <div className="sticky top-0 z-10 border-b bg-card p-3">
              <label className="flex h-10 items-center gap-2 rounded-lg bg-muted px-3 text-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input aria-label="Find your ward" value={wardSearch} onChange={e => setWardSearch(e.target.value)} placeholder="Find your ward" className="min-w-0 flex-1 bg-transparent outline-none" />
              </label>
            </div>
            {!wardRows.length ? (
              <div className="space-y-3 p-8 text-center">
                <h2 className="font-semibold">{wardSearch ? 'No ward matches that name' : 'No wards have reports yet'}</h2>
                <p className="text-sm text-muted-foreground">{wardSearch ? 'Try a ward number or area name.' : 'Search any of the 369 wards, or be the first to report.'}</p>
              </div>
            ) : wardRows.map(({ w, c }) => {
              const cases = list.filter(i => issueWard.get(i.id) === w.identifier);
              const isOpen = openRow === w.identifier;
              return (
                <div key={w.identifier} className="border-b">
                  <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary" onClick={() => setOpenRow(isOpen ? null : w.identifier)} aria-expanded={isOpen}>
                    <span className="grid h-10 min-w-10 place-items-center rounded-lg border bg-card px-2 font-mono text-sm font-bold tabular-nums">{c?.reports ?? 0}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2"><b className="text-sm">{w.name}</b><span className="font-mono text-[11px] text-muted-foreground">{corporationShort(w.corporation)} #{w.ward_number}</span></span>
                      <span className="block truncate text-xs text-muted-foreground">{c?.unresolved ?? 0} unresolved{w.mla ? ` · ${w.mla}` : ''}</span>
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="space-y-2 bg-muted/40 px-4 pb-4 pt-1">
                      {cases.length ? cases.map(i => (
                        <Link key={i.id} to="/issues/$ref" params={{ ref: i.ref_code }} className="flex gap-3 rounded-lg border bg-card p-2.5 hover:shadow-soft">
                          {i.photo_url && <img src={i.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" loading="lazy" />}
                          <span className="min-w-0"><b className="line-clamp-1 text-sm">{i.title}</b><span className="block text-xs text-muted-foreground">{categoryById(i.category).label} · {i.ref_code}</span></span>
                        </Link>
                      )) : <p className="text-xs text-muted-foreground">No cases match the current filters.</p>}
                      <Button size="sm" variant="outline" onClick={() => { setMode('map'); focusWard(w.identifier); }}>Show on map</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Count pill */}
        <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center">
          <div className="pointer-events-auto flex items-center gap-4 rounded-full border bg-card px-5 py-2 shadow-lift">
            <span className="text-sm"><b className="font-mono text-lg text-destructive tabular-nums">{activeTotal}</b> <span className="text-muted-foreground">Active</span></span>
            <span className="h-5 w-px bg-border" />
            <span className="text-sm"><b className="font-mono text-lg tabular-nums">{allCanonical.length}</b> <span className="text-muted-foreground">Reports</span></span>
          </div>
        </div>

        {mode === 'map' && <>
          {/* Locate */}
          <button onClick={locate} aria-label="Show my location" className="absolute bottom-[10.5rem] right-[10px] z-[500] grid h-10 w-10 place-items-center rounded-xl border bg-card shadow-soft hover:bg-secondary">
            {gps.state === 'locating' && !gps.fix ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <LocateFixed className={`h-5 w-5 ${youPoint ? 'text-[color:var(--map-you)]' : 'text-muted-foreground'}`} />}
          </button>

          {/* Location status */}
          {status_pill && !selectedIssue && (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[500] flex justify-center px-16">
              <p role="status" className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium shadow-lift">{status_pill.icon}{status_pill.text}</p>
            </div>
          )}

          {/* Ward card */}
          {cardWard && !selectedIssue && (
            <div className={`absolute bottom-4 left-3 z-[500] w-[min(20rem,calc(100%-5rem))] rounded-2xl border bg-card shadow-lift ${status_pill ? 'mb-12' : ''}`}>
              <div className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {cardKind === 'here' && <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-success"><span className="h-1.5 w-1.5 rounded-full bg-success" />YOU ARE HERE · ±{Math.round(gps.fix?.accuracy ?? 0)} M</p>}
                    {cardKind === 'near' && <p className="text-[10px] font-bold tracking-wider text-warning-foreground">APPROX. LOCATION · ±{Math.round(gps.fix?.accuracy ?? 0)} M</p>}
                    {cardKind === 'saved' && <p className="text-[10px] font-bold tracking-wider text-muted-foreground">YOUR SAVED LOCATION</p>}
                    <h2 className="truncate font-display text-base font-bold">{cardWard.name}</h2>
                    <p className="font-mono text-[11px] text-muted-foreground">{corporationShort(cardWard.corporation)} #{cardWard.ward_number}{cardWard.zone ? ` · ${cardWard.zone}` : ''}</p>
                  </div>
                  {tappedWard && <button aria-label="Close ward" className="rounded-md p-1 text-muted-foreground hover:bg-secondary" onClick={() => { setTappedWard(null); setDetails(false); }}><X className="h-4 w-4" /></button>}
                </div>
                <p className="mt-2 font-mono text-sm"><b className="text-destructive">{cardCount?.unresolved ?? 0} active</b> <span className="text-muted-foreground">· {cardCount?.reports ?? 0} reports in ward</span></p>
                {cardKind && cardKind !== 'tapped' && nearby.data && <p className="font-mono text-xs text-muted-foreground"><b className="text-foreground">{nearby.data.active}</b> active within 2 km{nearby.data.critical ? ` · ${nearby.data.critical} critical` : ''}</p>}
                <button className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary" onClick={() => setDetails(!details)} aria-expanded={details}>
                  {details ? 'Hide ward details' : 'MLA, MP & who handles it'}<ChevronDown className={`h-3.5 w-3.5 transition ${details ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {details && cardPoint && <div className="max-h-[45vh] overflow-y-auto border-t p-3"><CivicInfo lat={cardPoint.lat} lng={cardPoint.lng} {...(category !== 'all' ? { category } : {})} /></div>}
            </div>
          )}

          {/* Selected case */}
          {selectedIssue && (
            <div className="absolute inset-x-3 bottom-4 z-[500] rounded-2xl border bg-card p-4 shadow-lift sm:right-auto sm:w-96">
              <div className="flex items-start justify-between gap-2">
                <StatusBadge status={selectedIssue.status} />
                <button aria-label="Close case preview" className="rounded-md p-1 text-muted-foreground hover:bg-secondary" onClick={() => setSelected(null)}><X className="h-4 w-4" /></button>
              </div>
              <div className="mt-2 flex gap-3">
                {selectedIssue.photo_url && <img src={selectedIssue.photo_url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />}
                <div className="min-w-0">
                  <h3 className="line-clamp-2 text-sm font-semibold">{selectedIssue.title}</h3>
                  <p className="text-xs text-muted-foreground">{categoryById(selectedIssue.category).label} · {selectedIssue.ref_code}</p>
                </div>
              </div>
              <Button asChild className="mt-3 w-full"><Link to="/issues/$ref" params={{ ref: selectedIssue.ref_code }}>View case<ArrowRight className="h-4 w-4" /></Link></Button>
            </div>
          )}
        </>}
      </div>

      {/* Bottom bar */}
      <div className="flex gap-2 border-t bg-card px-3 py-2.5">
        <Button asChild variant="outline" size="icon" className="h-12 w-12 shrink-0 rounded-xl" aria-label="Ward analytics">
          <Link to="/explore"><BarChart3 className="h-5 w-5" /></Link>
        </Button>
        <Button asChild className="h-12 flex-1 rounded-xl text-base font-semibold shadow-lift">
          <Link to="/report"><Camera className="h-5 w-5" />Report a Problem</Link>
        </Button>
      </div>
    </div>
  );
}
