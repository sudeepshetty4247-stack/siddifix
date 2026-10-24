import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Building2 } from 'lucide-react';
import { getTransparency } from '@/lib/transparency.functions';
import { cn } from '@/lib/utils';

const PERIODS = [{ v: 30, l: '30 days' }, { v: 90, l: '90 days' }, { v: 0, l: 'All time' }] as const;

/** Citywide Bengaluru overview from the full canonical-case aggregate (merged duplicates count once). */
export function CityOverview() {
  const [days, setDays] = useState<0 | 30 | 90>(0);
  const q = useQuery({ queryKey: ['city-overview', days], queryFn: () => getTransparency({ data: { days } }), refetchInterval: 60000 });
  const s = q.data?.summary;
  const items = s ? [
    { label: 'Unique issues', value: s.total, hint: 'Duplicates count once' },
    { label: 'Active', value: s.active, hint: 'Open right now', tone: 'text-primary' },
    { label: 'Resolved', value: s.resolved, hint: 'Resolved or closed', tone: 'text-success' },
    { label: 'Overdue', value: s.overdue, hint: 'Past Siddi target', tone: 'text-warning-foreground' },
    { label: 'Acknowledged', value: s.acknowledged, hint: 'Staff responded' },
    { label: 'Escalated', value: s.escalated, hint: 'Supervisor follow-up' },
  ] : [];
  return (
    <section aria-labelledby="city-overview" className="border-b bg-card">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-primary"><Building2 className="h-3.5 w-3.5" />Bengaluru · citywide</p>
            <h2 id="city-overview" className="mt-1 text-xl font-semibold">How the city is doing</h2>
          </div>
          <div role="group" aria-label="Reporting period" className="flex rounded-lg border p-0.5">
            {PERIODS.map(p => <button key={p.v} onClick={() => setDays(p.v)} aria-pressed={days === p.v} className={cn('rounded-md px-3 py-1.5 text-xs font-medium', days === p.v ? 'bg-secondary text-foreground' : 'text-muted-foreground')}>{p.l}</button>)}
          </div>
        </div>
        {q.isPending ? <p role="status" className="mt-5 text-sm text-muted-foreground">Loading city totals…</p>
          : q.isError ? <p role="alert" className="mt-5 text-sm">City totals couldn't be loaded. <button className="underline" onClick={() => q.refetch()}>Try again</button></p>
          : s && s.total === 0 ? <div className="mt-5 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No Siddi reports recorded {days ? `in the last ${days} days` : 'yet'}. Numbers appear here as soon as real citizens report — we never show sample data.</div>
          : <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3 lg:grid-cols-6">
              {items.map(i => <div key={i.label} className="bg-card px-4 py-3"><dt className="text-xs text-muted-foreground">{i.label}</dt><dd className={cn('mt-0.5 text-2xl font-bold tabular-nums', i.tone)}>{i.value}</dd><p className="text-[11px] text-muted-foreground">{i.hint}</p></div>)}
            </dl>}
        <Link to="/transparency" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">Full transparency report<ArrowRight className="h-4 w-4" /></Link>
      </div>
    </section>
  );
}
