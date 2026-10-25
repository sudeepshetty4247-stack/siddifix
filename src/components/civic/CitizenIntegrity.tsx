import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {useState} from 'react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {citizenIntegrityStatus,citizenIntegrityResponse} from '@/lib/integrity.functions';

export function CitizenIntegrity({reference,token}:{reference:string;token:string}){
  const load=useServerFn(citizenIntegrityStatus),respond=useServerFn(citizenIntegrityResponse);const qc=useQueryClient();const [note,setNote]=useState(''),[busy,setBusy]=useState(false);
  const query=useQuery({queryKey:['citizen-integrity',reference],queryFn:()=>load({data:{ref:reference,token}}),refetchInterval:15000});
  if(query.isError)return <p role="alert" className="text-sm">Review details could not be loaded. <Button variant="ghost" onClick={()=>query.refetch()}>Retry</Button></p>;
  if(!query.data)return null;const state=query.data.state;const canRespond=['invalid','information_requested'].includes(state);
  return <section className="space-y-3 border-y py-5"><h2 className="font-semibold">Report verification</h2><p className="text-sm">{state.replaceAll('_',' ')}</p>{query.data.reason&&<p className="text-sm">{query.data.reason}</p>}{['pending_review','appealed','unverified'].includes(state)&&<p className="text-sm text-muted-foreground">Your report is preserved. A review is not a finding of wrongdoing.</p>}
    {canRespond&&<><label className="block text-sm font-medium">{state==='invalid'?'Request another review':'Add clarification'}<textarea aria-label="Report clarification" value={note} onChange={e=>setNote(e.target.value)} maxLength={1000} rows={3} className="mt-2 w-full rounded-md border bg-background p-3 font-normal"/></label><p className="text-xs text-muted-foreground">Only authorized reviewers can read your clarification. Your incident point is not changed.</p><Button disabled={busy||note.trim().length<5} onClick={async()=>{setBusy(true);try{await respond({data:{ref:reference,token,note}});setNote('');await qc.invalidateQueries({queryKey:['citizen-integrity',reference]});toast.success('Your response is saved for review');}catch(e){toast.error(e instanceof Error?e.message:'Response could not be saved');}finally{setBusy(false);}}}>{busy?'Saving…':state==='invalid'?'Submit appeal':'Send clarification'}</Button></>}
  </section>;
}