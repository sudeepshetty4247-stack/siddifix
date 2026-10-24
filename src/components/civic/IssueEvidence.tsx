import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getIssueEvidence, recordEvidence } from '@/lib/evidence.functions';
import { Button } from '@/components/ui/button';

export function IssueEvidence({ issueId, staff = false }: { issueId: string; staff?: boolean }) {
  const read = useServerFn(getIssueEvidence);
  const write = useServerFn(recordEvidence);
  const qc = useQueryClient();
  const [kind, setKind] = useState<'inspection'|'completion'|'external_action'>('completion');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [request,setRequest]=useState<string|null>(null);
  const [failed,setFailed]=useState(false);
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['issue-evidence', issueId], queryFn: () => read({ data: { issueId } }), refetchInterval: 30000 });
  async function choose(file?: File) {
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 25*1024*1024) { toast.error('Choose a JPG, PNG or WebP photo under 25 MB.'); return; }
    try {
      const bitmap = await createImageBitmap(file);
      const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width*ratio); canvas.height = Math.round(bitmap.height*ratio);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Photo processing unavailable');
      context.drawImage(bitmap,0,0,canvas.width,canvas.height); bitmap.close();
      setPhoto(canvas.toDataURL('image/jpeg',0.82));setRequest(null);setFailed(false);
    } catch { toast.error('This photo could not be read.'); }
  }
  async function save() {
    if (!photo || busy) return;
    setBusy(true);setFailed(false);
    const key=request??crypto.randomUUID();setRequest(key);
    try {
      await write({ data: { issueId, kind, note, imageDataUrl: photo,requestId:key } });
      setPhoto(null); setNote('');setRequest(null); toast.success('Evidence recorded in the case history.');
      await qc.invalidateQueries({ queryKey:['issue-evidence',issueId] });
      await qc.invalidateQueries({ queryKey:['staff-events',issueId] });
    } catch(e) { setFailed(true);toast.error(e instanceof Error ? e.message : 'Evidence could not be saved.'); }
    finally { setBusy(false); }
  }
  if (!staff && !q.isError && !q.data?.length) return null;
  return <section className="space-y-4 border-t py-5"><h2 className="text-lg font-semibold">Inspection & completion evidence</h2>
    {q.isError && <div role="alert"><p>Evidence could not be loaded.</p><Button variant="outline" onClick={()=>q.refetch()}>Retry evidence</Button></div>}
    {q.data?.map(e=><article key={e.id} className="space-y-2 border-b pb-4"><h3 className="text-sm font-semibold">{e.kind==='completion'?'Completion record':e.kind==='inspection'?'Inspection record':'Recorded external action'}</h3>{e.photoUrl?<img src={e.photoUrl} alt={e.note} className="max-h-96 w-full rounded-lg object-contain"/>:<p className="text-sm text-muted-foreground">Photo temporarily unavailable.</p>}<p className="text-sm">{e.note}</p><p className="text-xs text-muted-foreground">Recorded {new Date(e.recordedAt).toLocaleString('en-IN')} · photo capture time not verified</p></article>)}
    {staff && <div className="space-y-3"><label className="block text-sm">Evidence type<select aria-label="Evidence type" value={kind} disabled={busy} onChange={e=>{setKind(e.target.value as typeof kind);setRequest(null);}} className="mt-1 h-10 w-full rounded-lg border bg-card px-3"><option value="inspection">Inspection</option><option value="completion">Completion</option><option value="external_action">External action / acknowledgment</option></select></label>
      <label className="block text-sm">Public evidence description<textarea aria-label="Evidence description" value={note} disabled={busy} maxLength={1000} onChange={e=>{setNote(e.target.value);setRequest(null);}} className="mt-1 w-full rounded-lg border bg-card p-3"/></label>
      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-primary"><Camera className="h-4 w-4"/>{photo?'Change evidence photo':'Choose evidence photo'}<input aria-label="Evidence photo" type="file" disabled={busy} accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e=>choose(e.target.files?.[0])}/></label>
      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-primary"><Camera className="h-4 w-4"/>Take completion photo<input aria-label="Capture evidence photo" type="file" disabled={busy} accept="image/*" capture="environment" className="sr-only" onChange={e=>choose(e.target.files?.[0])}/></label>
      {busy&&<div role="status" className="text-sm"><progress aria-label="Uploading and verifying evidence" className="h-2 w-full"/>Uploading and verifying stored evidence…</div>}
      {failed&&<p role="alert" className="text-sm text-destructive">Evidence was not confirmed. Your selected photo is retained for retry.</p>}
      {photo&&<Button variant="outline" disabled={busy} onClick={()=>{setPhoto(null);setRequest(null);}}>Remove selected photo</Button>}
      {photo&&<img src={photo} alt="Selected evidence" className="max-h-60 w-full rounded-lg object-contain"/>}
      <p className="text-xs text-muted-foreground">This photo and description are published with the case. Remove faces, personal information and private correspondence. Completion evidence is required before resolving.</p>
      <Button disabled={!photo||note.trim().length<5||busy} onClick={save}>{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Camera className="h-4 w-4"/>}{failed?"Retry evidence upload":"Record evidence"}</Button>
    </div>}
  </section>;
}