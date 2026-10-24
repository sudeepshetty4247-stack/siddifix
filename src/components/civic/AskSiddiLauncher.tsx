import { useEffect, useState } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { MessageCircle, X } from 'lucide-react';

const HIDE_KEY = 'siddi-assistant-launcher-hidden';
/** Floating entry to the existing Ask Siddi assistant; hidden where it would cover primary actions. */
export function AskSiddiLauncher() {
  const path = useRouterState({ select: s => s.location.pathname });
  const [hidden, setHidden] = useState(false);
  useEffect(() => { try { setHidden(sessionStorage.getItem(HIDE_KEY) === '1'); } catch { /* optional */ } }, []);
  if (hidden || path.startsWith('/assistant') || path.startsWith('/report') || path.startsWith('/map')) return null;
  return (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-[1500] flex items-center gap-1">
      <Link to="/assistant" aria-label="Ask Siddi — open the assistant" className="group inline-flex h-12 items-center gap-2 rounded-full bg-ink pl-3 pr-4 text-sm font-semibold text-ink-foreground shadow-soft ring-1 ring-border transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"><MessageCircle className="h-4 w-4" /></span>
        Ask Siddi
      </Link>
      <button aria-label="Hide Ask Siddi button" onClick={() => { setHidden(true); try { sessionStorage.setItem(HIDE_KEY, '1'); } catch { /* optional */ } }} className="flex h-7 w-7 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-soft hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}
