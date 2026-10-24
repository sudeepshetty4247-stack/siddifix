import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getDirectory } from '@/lib/directory.functions';
import { rankWards, type WardCount } from '@/lib/wards';

export function WardLeaderboard() {
  const dir = useQuery({ queryKey: ['civic-directory'], queryFn: () => getDirectory(), staleTime: 300000 });
  const counts = useQuery({ queryKey: ['ward-case-counts'], refetchInterval: 60000, queryFn: async () => {
    const { data, error } = await supabase.rpc('ward_case_counts'); if (error) throw error;
    return (data ?? []).map(r => ({ ...r, reports: Number(r.reports), unique_issues: Number(r.unique_issues), unresolved: Number(r.unresolved), resolved: Number(r.resolved) })) as WardCount[];
  } });
  const wards = dir.data?.wards ?? [];
  if (!wards.length) return null;
  const names = new Map(wards.map(w => [w.identifier, `${w.name}`]));
  const meta = new Map(wards.map(w => [w.identifier, `${w.corporation.replace('Bengaluru ', '').replace(' City Corporation', '')} #${w.ward_number ?? ''}`]));
  const all = counts.data ?? [];
  const rows = rankWards(all, names);
  const totals = all.reduce((s, r) => ({ reports: s.reports + r.reports, unique: s.unique + r.unique_issues, open: s.open + r.unresolved, done: s.done + r.resolved }), { reports: 0, unique: 0, open: 0, done: 0 });
  return <section className="border-t p-4">
    <h2 className="flex items-center gap-2 font-semibold"><Trophy className="h-4 w-4 text-primary" />Ward leaderboard</h2>
    <p className="text-xs text-muted-foreground">{all.length} of {wards.length} wards have Siddi reports · saved Siddi data only</p>
    {counts.isError ? <p className="mt-3 text-sm">Rankings could not load.</p> : rows.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No ward has a Siddi report yet. Rankings appear once citizens report.</p> : <>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px]">
        <div className="rounded-lg bg-muted p-2"><b className="block text-base">{totals.reports}</b>Reports</div>
        <div className="rounded-lg bg-primary/10 p-2"><b className="block text-base">{totals.unique}</b>Unique issues</div>
        <div className="rounded-lg bg-warning/10 p-2"><b className="block text-base">{totals.open}</b>Unresolved</div>
        <div className="rounded-lg bg-success/10 p-2"><b className="block text-base">{totals.unique ? Math.round(totals.done * 100 / totals.unique) : 0}%</b>Resolved</div>
      </div>
      <ol className="mt-4 space-y-4">{rows.map((r, n) => {
        const pct = r.unique_issues ? Math.round(r.resolved * 100 / r.unique_issues) : 0;
        return <li key={r.ward_identifier}>
          <div className="flex items-baseline gap-2 text-sm">
            <span className="w-5 shrink-0 text-xs text-muted-foreground">{n + 1}</span>
            <span className="min-w-0 flex-1 truncate font-semibold">{r.name} <span className="text-xs font-normal text-muted-foreground">{meta.get(r.ward_identifier)}</span></span>
            <span className="shrink-0 text-sm font-bold text-success">{r.resolved} <span className="text-xs font-normal text-muted-foreground">of {r.unique_issues}</span></span>
          </div>
          <div className="ml-7 mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} /></div>
          <p className="ml-7 mt-1 text-xs"><span className="font-medium text-success">{pct}% resolved</span><span className="text-muted-foreground"> · {r.unresolved} unresolved · {r.reports} reports</span></p>
        </li>;
      })}</ol>
    </>}
  </section>;
}
