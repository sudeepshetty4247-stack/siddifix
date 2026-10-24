import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { OPEN_STATUSES } from '@/lib/civic';
import { findWard, loadWards } from '@/lib/wards';

type Row = { lat: number; lng: number; status: string };

export function WardLeaderboard({ issues }: { issues: Row[] }) {
  const wards = useQuery({ queryKey: ['bengaluru-wards'], queryFn: loadWards, staleTime: Infinity });
  if (!wards.data) return null;
  const tally = new Map<string, { name: string; corp: string; open: number; resolved: number }>();
  for (const i of issues) {
    const w = findWard(wards.data, i.lat, i.lng);
    if (!w) continue;
    const t = tally.get(w.id) ?? { name: `${w.no}. ${w.name}`, corp: w.corporation.replace('Bengaluru ', '').replace(' City Corporation', ''), open: 0, resolved: 0 };
    if (OPEN_STATUSES.includes(i.status as never)) t.open++; else t.resolved++;
    tally.set(w.id, t);
  }
  const rows = [...tally.values()].sort((a, b) => b.open - a.open || b.resolved - a.resolved).slice(0, 10);
  const open = rows.reduce((s, r) => s + r.open, 0), resolved = rows.reduce((s, r) => s + r.resolved, 0);
  return <section className="border-t p-4">
    <h2 className="flex items-center gap-2 font-semibold"><Trophy className="h-4 w-4 text-primary" />Ward leaderboard</h2>
    <p className="text-xs text-muted-foreground">369 Greater Bengaluru wards · CivicFix cases only</p>
    {rows.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No wards have CivicFix cases yet. Rankings appear once citizens report.</p> : <>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-lg bg-warning/10 p-2"><b className="block text-lg">{open}</b>Unresolved</div><div className="rounded-lg bg-success/10 p-2"><b className="block text-lg">{resolved}</b>Resolved</div><div className="rounded-lg bg-primary/10 p-2"><b className="block text-lg">{open + resolved ? Math.round(resolved * 100 / (open + resolved)) : 0}%</b>Rate</div></div>
      <ol className="mt-3 space-y-1.5">{rows.map((r, n) => <li key={r.name} className="flex items-center gap-2 text-sm"><span className="w-5 text-xs text-muted-foreground">{n + 1}</span><span className="min-w-0 flex-1 truncate">{r.name} <span className="text-xs text-muted-foreground">· {r.corp}</span></span><span className="text-xs font-semibold text-warning-foreground">{r.open}</span><span className="text-xs text-success">{r.resolved}</span></li>)}</ol>
    </>}
  </section>;
}
