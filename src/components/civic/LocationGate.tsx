import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { ArrowRight, Loader2, LocateFixed, MapPin } from 'lucide-react';
import { useLocation } from '@/lib/location';
import { BENGALURU, isInIndia } from '@/lib/civic';
import { suggestedReportLocation } from '@/lib/report-location';
import { NEARBY_RADIUS_METRES } from '@/lib/nearby-cases';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Logo } from './Logo';
import { LazyMap } from './LazyMap';

const summarySchema = z.object({ total: z.number(), active: z.number(), resolved: z.number(), overdue: z.number(), critical: z.number(), radius_m: z.number() });
const wardSchema = z.object({ name: z.string(), ward_number: z.number().nullable(), zone: z.string().nullable(), corporation: z.string().nullable() });
const KEY = 'civicfix-location-v1';

function hadStoredLocation() {
  if (typeof window === 'undefined') return true;
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(saved) && saved.length > 0;
  } catch {
    return false;
  }
}

/**
 * First-visit location screen: asks for the neighbourhood once (GPS or manual pin),
 * confirms the ward and nearby active cases, then lets the citizen in.
 */
export function LocationGate() {
  const { location, select, locating, detect, notice } = useLocation();
  const [mounted, setMounted] = useState(false);
  const [returning] = useState(hadStoredLocation);
  const [dismissed, setDismissed] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [label, setLabel] = useState('');
  const wasEmpty = useRef(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (!location) wasEmpty.current = true; }, [location]);

  const point = suggestedReportLocation(location);
  const directory = useQuery({ queryKey: ['civic-directory'], queryFn: () => getDirectory(), staleTime: 300000 });
  const routing = point && directory.data ? resolveCivicRouting(directory.data, point.lat, point.lng) : null;
  const counts = useQuery({
    queryKey: ['nearby-case-summary', point?.lat, point?.lng],
    enabled: !!point,
    queryFn: async () => {
      if (!point) throw new Error('Select a location');
      const result = await supabase.rpc('nearby_case_summary', { _lat: point.lat, _lng: point.lng, _radius_m: NEARBY_RADIUS_METRES });
      if (result.error) throw result.error;
      return summarySchema.parse(result.data);
    },
  });

  if (!mounted || returning || dismissed) return null;

  // Confirmation step: the citizen just picked a location — show ward + active cases before entering.
  if (location && wasEmpty.current) {
    return (
      <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-soft sm:p-8">
          <Logo />
          <div className="mt-6 flex items-start gap-3">
            <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft"><MapPin className="h-5 w-5 text-primary" /></span>
            <div>
              <h1 className="text-xl font-bold">{location.label === 'Current location' ? 'Your location' : location.label}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {routing?.ward ? `${routing.ward.name} · Ward ${routing.ward.ward_number}${routing.ward.zone ? ` · ${routing.ward.zone}` : ''}` : directory.isPending ? 'Checking your ward…' : directory.isError ? 'Ward lookup is unavailable right now' : point ? 'Outside the published ward boundaries' : 'Approximate location — refine it from the map anytime'}
              </p>
            </div>
          </div>
          {point && (
            <dl className="mt-6 grid grid-cols-2 gap-4 rounded-xl bg-primary-soft p-4">
              <div><dt className="text-xs text-muted-foreground">Active cases nearby</dt><dd className="mt-1 text-2xl font-bold tabular-nums text-primary">{counts.isPending ? '…' : counts.data?.active ?? '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Resolved nearby</dt><dd className="mt-1 text-2xl font-bold tabular-nums text-success">{counts.isPending ? '…' : counts.data?.resolved ?? '—'}</dd></div>
            </dl>
          )}
          <p className="mt-3 text-xs text-muted-foreground">CivicFix reports within 2 km of your point. No cases yet means yours can be the first.</p>
          <Button className="mt-6 w-full" size="lg" onClick={() => setDismissed(true)}>Continue <ArrowRight className="h-4 w-4" /></Button>
        </div>
      </div>
    );
  }

  if (location) return null;

  return (
    <div className="fixed inset-0 z-[2000] overflow-y-auto bg-background">
      <div className="mx-auto flex min-h-full w-full max-w-lg flex-col px-4 py-8 sm:py-12">
        <Logo />
        <h1 className="mt-8 text-2xl font-bold sm:text-3xl">Where in Bengaluru are you?</h1>
        <p className="mt-2 text-sm text-muted-foreground">We use your location once to show active cases near you and to place your reports in the right ward. It stays on this device.</p>

        <Button size="lg" className="mt-6 w-full" onClick={() => detect()} disabled={locating}>
          {locating ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
          {locating ? 'Finding you…' : 'Use my current location'}
        </Button>
        {notice && <p role="status" className="mt-3 text-sm text-warning-foreground">{notice}</p>}

        <div className="my-6 flex items-center gap-3 text-xs font-semibold text-muted-foreground"><span className="h-px flex-1 bg-border" />OR CHOOSE ON THE MAP<span className="h-px flex-1 bg-border" /></div>

        <div className="h-64 overflow-hidden rounded-xl border"><LazyMap center={pin ?? BENGALURU} picked={pin} onPick={(lat, lng) => setPin({ lat, lng })} recenter={pin} zoom={12} /></div>
        <label className="mt-4 space-y-1 text-sm font-medium">Area or landmark
          <input aria-label="Area or landmark" value={label} onChange={e => setLabel(e.target.value)} maxLength={120} placeholder="e.g. Kudlu Gate, HSR Layout" className="h-11 w-full rounded-lg border bg-card px-3 font-normal" />
        </label>
        <Button className="mt-4 w-full" size="lg" variant="outline" disabled={!pin || !isInIndia(pin.lat, pin.lng)} onClick={() => { if (pin) select({ ...pin, label: label.trim() || `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`, method: 'manual' }); }}>
          Confirm this location
        </Button>
        {pin && !isInIndia(pin.lat, pin.lng) && <p role="alert" className="mt-2 text-sm text-destructive">CivicFix currently serves Bengaluru, India. Pick a point inside the city.</p>}
      </div>
    </div>
  );
}
