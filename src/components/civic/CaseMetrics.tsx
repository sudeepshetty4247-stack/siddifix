import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { STATUS_META, type IssueStatus } from '@/lib/civic';

export function CaseMetrics() {
  const q = useQuery({ queryKey: ['case-metrics'], refetchInterval: 30000, queryFn: async () => {
    const result = await supabase.rpc('civic_case_metrics');
    if (result.error) throw result.error;
    if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) throw new Error('Metrics unavailable');
    return result.data;
  } });
  if (q.isError) return <section role="alert"><p>Case metrics could not be loaded.</p><Button variant="outline" onClick={() => q.refetch()}>Retry metrics</Button></section>;
  const rows = [['Citizen reports','total_reports'],['Canonical issues','canonical_issues'],['Duplicate rate','duplicate_rate'],['Pending cases','pending'],['Resolved cases','resolved'],['Resolution rate','resolution_rate'],['Overdue cases','overdue'],['Reopened cases','reopened'],['Avg. resolution hours','average_resolution_hours']];
  const distribution = q.data?.['status_distribution'];
  return <section className="border-y py-6"><h2 className="text-xl font-semibold">Resolution analytics</h2><dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">{rows.map(([label,key]) => <div key={key}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="font-display text-2xl font-semibold">{q.isLoading ? '—' : typeof q.data?.[key ?? ''] === 'number' ? `${Math.round(Number(q.data?.[key ?? ''])*100)/100}${key?.endsWith('rate') ? '%' : ''}` : '—'}</dd></div>)}</dl><h3 className="mt-5 font-semibold">Canonical status distribution</h3><div className="mt-3 flex flex-wrap gap-4">{Object.entries(STATUS_META).map(([key,meta]) => <span key={key} className="text-sm text-muted-foreground">{meta.label}: <strong className="text-foreground">{distribution && typeof distribution === 'object' && !Array.isArray(distribution) ? String(distribution[key as IssueStatus] ?? 0) : q.isLoading ? '—' : 0}</strong></span>)}</div></section>;
}