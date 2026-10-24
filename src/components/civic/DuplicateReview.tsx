import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { descriptionOverlap } from '@/lib/duplicate-evidence';

export function DuplicateReview({ issue }: { issue: { id: string; lat: number; lng: number; category: string; title: string; summary: string | null; photo_url: string | null; duplicate_of: string | null } }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['duplicate-candidates', issue.id], queryFn: async () => {
    const nearby = await supabase.rpc('nearby_issues', { _lat: issue.lat, _lng: issue.lng, _radius_m: 120, _category: issue.category });
    if (nearby.error) throw nearby.error;
    const ids = [...new Set([...(nearby.data ?? []).filter(r => r.id !== issue.id).map(r => r.id), ...(issue.duplicate_of ? [issue.duplicate_of] : [])])];
    if (!ids.length) return [];
    const result = await supabase.from('issues').select('id,ref_code,title,summary,photo_url,duplicate_of').in('id', ids);
    if (result.error) throw result.error;
    return (result.data ?? []).map(r => ({ ...r, distance: nearby.data?.find(n => n.id === r.id)?.distance_m }));
  } });
  async function decide(candidate: string, decision: 'merge' | 'reject' | 'reverse') {
    setBusy(true);
    try {
      const result = await supabase.rpc('review_issue_duplicate', { _report: issue.id, _candidate: candidate, _decision: decision, _reason: reason.trim() });
      if (result.error) throw result.error;
      toast.success('Duplicate decision recorded');setReason('');await qc.invalidateQueries();
    } catch(e) { toast.error(e instanceof Error ? e.message : 'Decision could not be saved'); }
    finally {setBusy(false);}
  }
  return <section className="border-t py-5"><h2 className="text-lg font-semibold">Duplicate review</h2><p className="mt-1 text-xs text-muted-foreground">Nearby same-category reports. Compare descriptions and photographs before deciding; originals and history are retained.</p>
    {q.isLoading ? <p className="py-4">Checking candidates…</p> : q.isError ? <Button variant="outline" onClick={() => q.refetch()}>Retry candidate search</Button> : !q.data?.length ? <p className="py-4 text-sm text-muted-foreground">No nearby candidates.</p> : <>
    <label className="mt-4 block text-sm">Decision reason<textarea aria-label="Duplicate decision reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} className="mt-2 w-full rounded-lg border bg-card p-3" /></label>
    {q.data.map(c => <article key={c.id} className="mt-4 border-b pb-4"><h3 className="font-semibold">{c.ref_code} · {c.title}</h3><p className="mt-1 text-xs text-muted-foreground">{c.distance === undefined ? 'Current linked issue' : `${Math.round(c.distance)} m away`} · Description word overlap: {Math.round(descriptionOverlap(`${issue.title} ${issue.summary ?? ''}`, `${c.title} ${c.summary ?? ''}`)*100)}% · not a match probability</p><div className="my-3 grid grid-cols-2 gap-3">{[issue.photo_url,c.photo_url].map((url,i) => url ? <img key={i} src={url} alt={i ? 'Candidate report evidence' : 'Current report evidence'} className="aspect-square w-full rounded-lg object-cover" /> : <p key={i}>No photo evidence</p>)}</div><div className="flex flex-wrap gap-2">{issue.duplicate_of === c.id ? <Button disabled={busy || reason.trim().length<5} variant="outline" onClick={() => decide(c.id,'reverse')}>Reverse merge</Button> : <><Button disabled={busy || reason.trim().length<5 || !!issue.duplicate_of || !!c.duplicate_of} onClick={() => decide(c.id,'merge')}>Confirm merge</Button><Button disabled={busy || reason.trim().length<5} variant="outline" onClick={() => decide(c.id,'reject')}>Reject match</Button></>}</div></article>)}
    </>}
  </section>;
}