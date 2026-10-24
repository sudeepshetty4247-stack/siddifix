import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function CaseCommunication({ issueId, status, supervisor }: { issueId: string; status: string; supervisor: boolean }) {
  const qc = useQueryClient();
  const [visibility, setVisibility] = useState<'public' | 'internal' | 'instruction'>('public');
  const [note, setNote] = useState('');
  const [template, setTemplate] = useState('');
  const [request, setRequest] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['response-templates'], queryFn: async () => {
    const r = await supabase.from('staff_response_templates').select('*').eq('active', true);
    if (r.error) throw r.error;
    return r.data;
  }});
  async function send() {
    setBusy(true);
    const key = request ?? crypto.randomUUID();
    setRequest(key);
    try {
      const r = await supabase.rpc('staff_case_message', { _issue: issueId, _note: note, _visibility: visibility, _request: key, ...template ? { _template: template } : {} });
      if (r.error) throw r.error;
      toast.success(visibility === 'public' ? 'Public update saved for citizen tracking.' : 'Internal message saved. Not visible to citizens.');
      setNote(''); setRequest(null); setTemplate('');
      await qc.invalidateQueries();
    } catch { toast.error('Message was not confirmed. Retry without changing it to safely reuse this request.'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4 border-t py-5"><h2 className="text-lg font-semibold">Case communication</h2><div className="flex flex-wrap gap-2" role="group" aria-label="Message visibility">{(['public', 'internal', ...supervisor ? ['instruction' as const] : []] as const).map(v => <Button key={v} size="sm" variant={visibility === v ? 'default' : 'outline'} disabled={busy} aria-pressed={visibility === v} onClick={() => { setVisibility(v); setRequest(null); }}>{v === 'public' ? 'Citizen update' : v === 'instruction' ? 'Supervisor instruction' : 'Internal note'}</Button>)}</div>
    {visibility === 'public' && <label className="block text-sm">Approved response<select className="mt-2 h-10 w-full rounded-md border bg-card px-3" value={template} onChange={e => { const t = q.data?.find(t => t.id === e.target.value); setTemplate(e.target.value); setNote(t?.body ?? ''); setRequest(null); }}><option value="">Personalized response</option>{q.data?.filter(t => !t.statuses.length || t.statuses.includes(status)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
    <p className="text-xs text-muted-foreground">{visibility === 'public' ? 'The citizen will see this text. Describe only actions that actually happened.' : 'Authorized staff only. This message is excluded from citizen tracking.'}</p><textarea aria-label="Case message" value={note} disabled={busy} maxLength={1000} rows={4} onChange={e => { setNote(e.target.value); setRequest(null); }} className="w-full rounded-md border bg-card p-3 text-sm"/>
    <Button disabled={busy || note.trim().length < 5} onClick={send}>{busy ? 'Saving…' : 'Save message'}</Button>
  </section>;
}