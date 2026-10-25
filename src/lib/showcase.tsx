import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const KEY = 'siddhi-showcase';

type ShowcaseCtx = { showcase: boolean; setShowcase: (v: boolean) => void };
const Ctx = createContext<ShowcaseCtx>({ showcase: true, setShowcase: () => {} });

/**
 * Live demonstration mode. When on, citizen pages include the labelled
 * synthetic demonstration dataset so the full pipeline can be shown end to end.
 * Genuine-only remains the database default; this only opts in per visitor.
 */
export function ShowcaseProvider({ children }: { children: ReactNode }) {
  const [showcase, setShowcaseState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(KEY) !== 'off';
  });
  useEffect(() => {
    window.localStorage.setItem(KEY, showcase ? 'on' : 'off');
  }, [showcase]);
  return <Ctx.Provider value={{ showcase, setShowcase: setShowcaseState }}>{children}</Ctx.Provider>;
}

export function useShowcase() {
  return useContext(Ctx);
}

/** Small persistent label shown wherever demonstration data is included. */
export function ShowcaseBadge({ className }: { className?: string }) {
  const { showcase } = useShowcase();
  if (!showcase) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-[11px] font-semibold text-warning-foreground', className)}>
      <Sparkles className="h-3 w-3" />Live demonstration data
    </span>
  );
}

/** Header toggle so a presenter can switch between genuine-only and the full showcase. */
export function ShowcaseToggle() {
  const { showcase, setShowcase } = useShowcase();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={showcase}
      aria-label="Show live demonstration data"
      onClick={() => setShowcase(!showcase)}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition',
        showcase ? 'border-warning/40 bg-warning/15 text-warning-foreground' : 'text-muted-foreground hover:bg-secondary',
      )}
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span className="hidden md:inline">Demo</span>
      <span className={cn('relative h-4 w-7 rounded-full transition', showcase ? 'bg-primary' : 'bg-muted')}>
        <span className={cn('absolute top-0.5 h-3 w-3 rounded-full bg-card shadow transition-all', showcase ? 'left-3.5' : 'left-0.5')} />
      </span>
    </button>
  );
}
