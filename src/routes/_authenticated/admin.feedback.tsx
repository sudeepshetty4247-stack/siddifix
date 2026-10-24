import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/_authenticated/admin/feedback')({
  head: () => ({ meta: [{ title: 'Citizen feedback — Siddhi' }, { name: 'description', content: 'Satisfaction survey results from original reporters of resolved cases.' }, { property: 'og:title', content: 'Citizen feedback — Siddhi' }, { property: 'og:description', content: 'Resolution satisfaction analytics.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' }] }),
  component: FeedbackPage,
});

type Summary = { responses: number; eligible: number; avg_rating: number | null; ratings: Record<string, number>; resolution: Record<string, number>; response_time: Record<string, number>; by_category: { category: string; n: number; avg: number }[]; by_month: { month: string; n: number; avg: number }[]; comments: { rating: number; comment: string; category: string; at: string }[] };

function Bars({ title, rows, total }: { title: string; rows: [string, number][]; total: number }) {
  return <div className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">{title}</h2><div className="mt-3 space-y-2">{rows.map(([l, n]) => <div key={l} className="text-sm"><div className="flex justify-between"><span>{l}</span><span className="tabular-nums text-muted-foreground">{n}</span></div><div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${total ? (n / total) * 100 : 0}%` }} /></div></div>)}</div></div>;
}

function FeedbackPage() {
  const q = useQuery({ queryKey: ['admin-feedback'], queryFn: async () => { const r = await supabase.rpc('admin_feedback_summary'); if (r.error) throw r.error; return r.data as unknown as Summary; } });
  if (q.isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading feedback…</p>;
  if (q.isError || !q.data) return <div role="alert" className="p-6"><p>Feedback could not be loaded.</p><Button variant="outline" onClick={() => q.refetch()}>Retry</Button></div>;
  const d = q.data; const t = d.responses;
  const complete = d.resolution['complete'] ?? 0;
  return <div className="space-y-6 p-4 md:p-6">
    <header><h1 className="text-2xl font-bold">Citizen feedback</h1><p className="text-sm text-muted-foreground">Answers from original reporters after a case is marked resolved. Respondents do not represent every citizen.</p></header>
    <div className="grid gap-3 sm:grid-cols-4">
      {[['Responses', String(t)], ['Participation', d.eligible ? `${Math.round((t / d.eligible) * 100)}% of ${d.eligible} resolved cases` : 'No resolved cases yet'], ['Average satisfaction', d.avg_rating != null ? `${d.avg_rating} / 5` : '—'], ['Said fully resolved', t ? `${Math.round((complete / t) * 100)}%` : '—']].map(([l, v]) => <div key={l} className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 text-lg font-semibold">{v}</p></div>)}
    </div>
    {t === 0 ? <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">No feedback has been submitted yet. Results appear here as reporters respond.</p> : <>
      <div className="grid gap-4 md:grid-cols-3">
        <Bars title="Satisfaction" total={t} rows={[5, 4, 3, 2, 1].map(r => [`${r} — ${['', 'Very dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very satisfied'][r]}`, d.ratings[String(r)] ?? 0])} />
        <Bars title="Was it resolved?" total={t} rows={[['Completely', d.resolution['complete'] ?? 0], ['Partially', d.resolution['partial'] ?? 0], ['Not resolved', d.resolution['not_resolved'] ?? 0]]} />
        <Bars title="Response time" total={t} rows={['excellent', 'good', 'average', 'poor'].map(k => [k[0]!.toUpperCase() + k.slice(1), d.response_time[k] ?? 0])} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">By category</h2><table className="mt-3 w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th>Category</th><th>Responses</th><th>Avg</th></tr></thead><tbody>{d.by_category.map(c => <tr key={c.category} className="border-t"><td className="py-1.5">{c.category}</td><td>{c.n}</td><td>{c.avg}</td></tr>)}</tbody></table></div>
        <div className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">By month</h2><table className="mt-3 w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th>Month</th><th>Responses</th><th>Avg</th></tr></thead><tbody>{d.by_month.map(c => <tr key={c.month} className="border-t"><td className="py-1.5">{c.month}</td><td>{c.n}</td><td>{c.avg}</td></tr>)}</tbody></table></div>
      </div>
      <div className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Recent comments</h2><p className="text-xs text-muted-foreground">Private to administrators. No reporter details are stored with feedback.</p><ul className="mt-3 divide-y">{d.comments.map((c, i) => <li key={i} className="py-2 text-sm"><span className="text-xs text-muted-foreground">{c.rating}/5 · {c.category} · {new Date(c.at).toLocaleDateString('en-IN')}</span><p>{c.comment}</p></li>)}</ul></div>
    </>}
  </div>;
}
