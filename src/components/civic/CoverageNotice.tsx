import { useEffect, useState } from 'react';
import { Compass, MapPin, PlayCircle, Sparkles, X } from 'lucide-react';
import { useLocation } from '@/lib/location';
import { Button } from '@/components/ui/button';
import { Logo } from './Logo';

const DISMISS = 'siddi-coverage-dismissed';

/** Friendly, honest screen when the selected point is outside Siddi's Bengaluru wards. */
export function CoverageNotice() {
  const { location, coverage, setOpen, enterDemo } = useLocation();
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  useEffect(() => { try { setDismissedFor(sessionStorage.getItem(DISMISS)); } catch { /* optional */ } }, []);
  const key = location ? `${location.lat.toFixed(3)},${location.lng.toFixed(3)}` : '';
  if (!location || location.method === 'demo' || coverage !== 'outside' || dismissedFor === key) return null;
  const dismiss = () => { setDismissedFor(key); try { sessionStorage.setItem(DISMISS, key); } catch { /* optional */ } };
  const place = location.label && location.label !== 'Current location' ? location.label : 'your current location';
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="coverage-title" className="fixed inset-0 z-[1900] flex items-end justify-center bg-ink/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="relative w-full max-w-lg rounded-t-3xl border bg-card p-6 shadow-soft sm:rounded-3xl sm:p-8">
        <button onClick={dismiss} aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-secondary"><X className="h-5 w-5" /></button>
        <Logo />
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-foreground"><Sparkles className="h-3.5 w-3.5" />Coming to more cities</div>
        <h1 id="coverage-title" className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">Your city deserves better. We're getting there.</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Siddi is currently available for civic issue reporting in <strong className="text-foreground">Bengaluru</strong>. We couldn't find {place} inside a supported ward, so we won't show Bengaluru numbers as if they were yours. You can explore the experience, pick another location, or try a clearly labelled Bengaluru demo.</p>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />Selected: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>
        <div className="mt-6 grid gap-2">
          <Button size="lg" onClick={() => { enterDemo(); dismiss(); }}><PlayCircle className="h-5 w-5" />Try Bengaluru demo</Button>
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" variant="outline" onClick={() => { dismiss(); setOpen(true); }}><Compass className="h-4 w-4" />Choose another location</Button>
            <Button size="lg" variant="ghost" onClick={dismiss}>Explore Siddi</Button>
          </div>
        </div>
        <p className="mt-4 text-[11px] text-muted-foreground">Demo mode never submits a real complaint and never changes public numbers.</p>
      </div>
    </div>
  );
}

/** Persistent strip that makes demo mode unmistakable and easy to leave. */
export function DemoBanner() {
  const { location, exitDemo } = useLocation();
  if (location?.method !== 'demo') return null;
  return (
    <div role="status" className="border-b border-warning/40 bg-warning/15">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 text-sm sm:px-6">
        <span className="flex min-w-0 items-center gap-2"><PlayCircle className="h-4 w-4 shrink-0" /><span className="truncate"><strong>Bengaluru demo</strong> · Explore freely. Submissions are simulated and never saved.</span></span>
        <Button size="sm" variant="outline" onClick={exitDemo}>Exit demo</Button>
      </div>
    </div>
  );
}
