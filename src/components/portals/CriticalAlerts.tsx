import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Siren } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/** Critical cases in the signed-in staff member's authorized scope that nobody has acknowledged yet. */
export function CriticalAlerts() {
  const q = useQuery({
    queryKey: ['critical-unacknowledged'],
    refetchInterval: 15000,
    queryFn: async () => {
      const r = await supabase.rpc('staff_queue_issues', { _severity: 'critical', _ack: 'unacknowledged', _limit: 20 });
      if (r.error) throw r.error;
      return (r.data ?? []).filter(i => !['resolved', 'closed', 'rejected'].includes(i.status));
    },
  });
  if (!q.data?.length) return null;
  return <section role="alert" aria-label="Critical incidents awaiting acknowledgement" className="mx-4 mt-4 rounded-2xl border-2 border-destructive bg-destructive/5 p-4 md:mx-6">
    <div className="flex items-center gap-2 font-semibold text-destructive"><Siren className="h-5 w-5" /> {q.data.length} critical incident{q.data.length > 1 ? 's' : ''} awaiting acknowledgement</div>
    <ul className="mt-3 divide-y divide-destructive/20">
      {q.data.map(i => <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
        <span><span className="font-mono text-xs text-muted-foreground">{i.ref_code}</span> · <span className="font-medium">{i.title}</span>{i.landmark ? <span className="text-muted-foreground"> · {i.landmark}</span> : null}</span>
        <Link to="/staff/issues/$id" params={{ id: i.id }} className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground">Open & acknowledge</Link>
      </li>)}
    </ul>
  </section>;
}
