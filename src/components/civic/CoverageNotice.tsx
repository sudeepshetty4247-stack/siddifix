import { useEffect, useState } from 'react';
import { Compass, MapPin, Rocket, X } from 'lucide-react';
import { useLocation } from '@/lib/location';
import { Button } from '@/components/ui/button';
import { Logo } from './Logo';

const DISMISS = 'siddi-coverage-dismissed';

/** Shown when the selected place is outside Bengaluru: service not available yet, change the place. */
export function CoverageNotice() {
  const { location, coverage, setOpen,activeArea } = useLocation();
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  useEffect(() => { try { setDismissedFor(sessionStorage.getItem(DISMISS)); } catch { /* optional */ } }, []);
  const key = location ? `${location.lat.toFixed(3)},${location.lng.toFixed(3)}` : '';
  if (activeArea?.id==='anantapur' || !location || coverage !== 'outside' || dismissedFor === key) return null;
  const dismiss = () => { setDismissedFor(key); try { sessionStorage.setItem(DISMISS, key); } catch { /* optional */ } };
  const place = location.label && location.label !== 'Current location' ? location.label : 'your area';
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="coverage-title" className="fixed inset-0 z-[1900] flex items-end justify-center bg-ink/60 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="relative w-full max-w-lg rounded-t-3xl border bg-card p-6 shadow-soft sm:rounded-3xl sm:p-8">
        <button onClick={dismiss} aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-secondary"><X className="h-5 w-5" /></button>
        <Logo />
        <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold"><Rocket className="h-3.5 w-3.5" />Service unavailable here — coming soon</span>
        <h1 id="coverage-title" className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">Your city deserves better. We're on our way.</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Siddhi isn't live in {place} yet. Every great street starts with one voice — and yours will be heard here soon. For now, Siddhi works in <strong className="text-foreground">Bengaluru</strong>.</p>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />Change your place to a Bengaluru location to report and track issues.</p>
        <div className="mt-6 grid gap-2">
          <Button size="lg" onClick={() => { dismiss(); setOpen(true); }}><Compass className="h-5 w-5" />Change place</Button>
          <Button size="lg" variant="ghost" onClick={dismiss}>Just look around</Button>
        </div>
      </div>
    </div>
  );
}
