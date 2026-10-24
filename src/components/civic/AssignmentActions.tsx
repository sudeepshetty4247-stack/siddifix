import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getDirectory } from '@/lib/directory.functions';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function AssignmentActions({ id, authorityId, state }: { id: string; authorityId: string | null; state: string }) {
  const [authority,setAuthority]=useState(authorityId ?? '');const [reason,setReason]=useState('');const [busy,setBusy]=useState(false);const qc=useQueryClient();
  const q=useQuery({queryKey:['civic-directory'],queryFn:()=>getDirectory()});
  async function act(action:'assign'|'accept'|'reject'|'escalate') {
    setBusy(true);try {const result=await supabase.rpc('assign_civic_issue',{_id:id,_authority:action==='assign' ? authority : authorityId ?? authority,_action:action,_reason:reason.trim()});if(result.error)throw result.error;setReason('');toast.success('Internal assignment decision recorded');await qc.invalidateQueries();}catch(e){toast.error(e instanceof Error ? e.message : 'Assignment could not be saved');}finally{setBusy(false);}
  }
  return <section className="border-t py-5"><h2 className="text-lg font-semibold">Assignment & escalation</h2><p className="mt-2 text-sm">Internal assignment: <strong>{state}</strong></p><p className="mt-1 text-xs text-muted-foreground">Acceptance records a CivicFix staff decision, not acceptance by the government organisation.</p><label className="mt-4 block text-sm">Verified service authority<select aria-label="Assignment authority" className="mt-2 h-10 w-full rounded-lg border bg-card px-3" value={authority} onChange={e=>setAuthority(e.target.value)}><option value="">Select authority</option>{q.data?.authorities.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label className="mt-4 block text-sm">Reason<textarea aria-label="Assignment reason" value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000} className="mt-2 w-full rounded-lg border bg-card p-3" /></label><div className="mt-3 flex flex-wrap gap-2"><Button disabled={busy||!authority||reason.trim().length<5} onClick={()=>act('assign')}>Assign / reassign</Button>{state==='pending'&&<><Button variant="outline" disabled={busy||reason.trim().length<5} onClick={()=>act('accept')}>Accept internally</Button><Button variant="outline" disabled={busy||reason.trim().length<5} onClick={()=>act('reject')}>Reject assignment</Button></>}<Button variant="outline" disabled={busy||reason.trim().length<5||!authorityId} onClick={()=>act('escalate')}>Escalate internally</Button></div></section>;
}