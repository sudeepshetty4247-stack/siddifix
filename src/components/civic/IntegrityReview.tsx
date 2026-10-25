import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {toast} from 'sonner';
import {ShieldCheck} from 'lucide-react';
import {supabase} from '@/integrations/supabase/client';
import {Button} from '@/components/ui/button';
import type {IntegritySignal} from '@/lib/report-integrity';
import type {LocationConsistency} from '@/lib/location-consistency';

export function IntegrityReview({issueId,onDone}:{issueId:string;onDone:()=>void}){
  const qc=useQueryClient();const [reason,setReason]=useState('');const [busy,setBusy]=useState(false);
  const review=useQuery({queryKey:['integrity',issueId],refetchInterval:15000,queryFn:async()=>{const r=await supabase.from('report_integrity').select('*').eq('issue_id',issueId).maybeSingle();if(r.error)throw r.error;return r.data;}});
  async function decide(decision:'verify'|'request_information'|'invalid'){
    setBusy(true);try{const r=await supabase.rpc('review_report_integrity',{_issue:issueId,_expected:review.data?.state??'unverified',_decision:decision,_reason:reason.trim()});if(r.error)throw r.error;setReason('');await qc.invalidateQueries({queryKey:['integrity']});onDone();toast.success('Review decision recorded');}catch(e){toast.error(e instanceof Error?e.message:'Review could not be saved');}finally{setBusy(false);}
  }
  return <section className="space-y-4 border-y py-5"><h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5 text-primary"/>Report integrity review</h2>
    {review.isError?<p role="alert">Review details unavailable. <Button variant="ghost" onClick={()=>review.refetch()}>Retry</Button></p>:<><p className="text-sm">{(review.data?.state??'unverified').replaceAll('_',' ')} · Risk signals {review.data?.risk_score??0}/100</p><p className="text-xs text-muted-foreground">Signals guide verification, not a finding of fraud. Photos and anonymous reporting are not prerequisites for legitimacy.</p>
    <ul className="space-y-2 text-sm">{((review.data?.signals??[]) as unknown as IntegritySignal[]).map(s=><li key={s.code}>{s.detail} <span className="text-muted-foreground">+{s.points}</span></li>)}</ul>{review.data?.review_reason&&<p className="text-sm">Last decision: {review.data.review_reason}</p>}
    <label className="block text-sm font-medium">Decision reason<textarea aria-label="Integrity review reason" className="mt-2 w-full rounded-md border bg-background p-3 font-normal" value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000} rows={3}/></label><p className="text-xs text-muted-foreground">This reason is public. Do not include personal or sensitive information.</p>
    <div className="flex flex-wrap gap-2"><Button disabled={busy||reason.trim().length<5||review.isPending} onClick={()=>decide('verify')}>Verify report</Button><Button variant="outline" disabled={busy||reason.trim().length<5||review.isPending} onClick={()=>decide('request_information')}>Request information</Button><Button variant="outline" disabled={busy||reason.trim().length<5||review.isPending} onClick={()=>decide('invalid')}>Mark invalid</Button></div></>}
  </section>;
}