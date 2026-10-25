import {useQuery} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {useState} from 'react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {integritySettings,saveIntegritySettings} from '@/lib/integrity.functions';
import {DEFAULT_INTEGRITY_CONFIG,integrityConfigSchema} from '@/lib/report-integrity';

export function IntegritySettings(){
  const load=useServerFn(integritySettings),save=useServerFn(saveIntegritySettings);const [draft,setDraft]=useState(DEFAULT_INTEGRITY_CONFIG),[busy,setBusy]=useState(false);
  const query=useQuery({queryKey:['integrity-settings'],queryFn:async()=>{const settings=await load();setDraft(settings);return settings;}});
  const labels={session_limit:'Session submissions per window',network_limit:'Shared network submissions per window',user_limit:'Signed-in account submissions per window',window_minutes:'Window duration (minutes)',challenge_after:'Verification question after submissions',review_threshold:'Review threshold (signal points)'};
  return <section className="mx-auto max-w-5xl space-y-4 border-t px-4 py-6 sm:px-8"><h2 className="text-xl font-bold">Submission protection settings</h2><p className="text-sm text-muted-foreground">Temporary controls, not permanent bans. Shared networks receive a separate, more generous allowance.</p>{query.isError?<p role="alert">Settings unavailable</p>:<><div className="grid gap-4 sm:grid-cols-2">{(Object.keys(labels) as (keyof typeof labels)[]).map(k=><label key={k} className="text-sm">{labels[k]}<input type="number" className="mt-2 block w-full rounded-md border bg-background p-2" value={draft[k]} onChange={e=>setDraft({...draft,[k]:Number(e.target.value)})}/></label>)}</div><Button disabled={busy||query.isPending} onClick={async()=>{const valid=integrityConfigSchema.safeParse(draft);if(!valid.success){toast.error(valid.error.issues[0]?.message??'Invalid settings');return;}setBusy(true);try{await save({data:valid.data});await query.refetch();toast.success('Protection settings saved and audited');}catch(e){toast.error(e instanceof Error?e.message:'Settings could not be saved');}finally{setBusy(false);}}}>Save protection settings</Button></>}</section>;
}