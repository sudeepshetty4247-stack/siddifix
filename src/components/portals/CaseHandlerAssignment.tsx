import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function CaseHandlerAssignment({ issueId, current }: { issueId: string; current: string | null }) {
  const qc = useQueryClient();
  const [handler, setHandler] = useState(current ?? '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['eligible-handlers', issueId], queryFn: async () => {
    const r = await supabase.rpc('eligible_case_handlers', { _issue: issueId });
    if (r.error) throw r.error;
    return r.data;
  }});
  async function save() {
    setBusy(true);
    try {
      const r = await supabase.rpc('staff_assign_handler', { _issue: issueId, _handler: handler, _reason: reason });
      if (r.error) throw r.error;
      toast.success('Case handler assigned');
      setReason('');
      await qc.invalidateQueries();
    } catch { toast.error('Handler could not be assigned. Check their active team and jurisdiction.'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 border-t py-5"><h2 className="text-lg font-semibold">Responsible case handler</h2>
    {q.isError ? <p role="alert">Eligible handlers could not be loaded.</p> : <>
      <label className="block text-sm">Handler<select className="mt-2 h-10 w-full rounded-md border bg-card px-3" value={handler} onChange={e => setHandler(e.target.value)}><option value="">Choose eligible staff</option>{q.data?.map(p => <option key={p.user_id} value={p.user_id}>{p.display_name || p.designation || 'Authorized staff'}</option>)}</select></label>
      {q.data?.length === 0 && <p className="text-sm text-muted-foreground">No active staff match this case’s department, team and jurisdiction.</p>}
      <label className="block text-sm">Assignment reason<input maxLength={500} value={reason} onChange={e => setReason(e.target.value)} className="mt-2 h-10 w-full rounded-md border bg-card px-3"/></label>
      <Button disabled={busy || !handler || reason.trim().length < 3} onClick={save}>Assign handler</Button>
    </>}
  </section>;
}