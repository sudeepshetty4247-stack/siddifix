import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Upload, ExternalLink, ShieldCheck } from 'lucide-react';
import { z } from 'zod';
import { getDirectory } from '@/lib/directory.functions';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useRoles } from './staff';

export const Route = createFileRoute('/_authenticated/staff/directory')({
  head: () => ({ meta: [{ title: 'Authority directory management — CivicFix' }, { name: 'description', content: 'Review source-backed civic authorities and import verified jurisdiction data.' }, { property: 'og:title', content: 'Authority directory management — CivicFix' }, { property: 'og:description', content: 'CivicFix authority provenance and coverage management.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' }] }),
  component: DirectoryPage,
});
const officialUrl = z.string().url().refine(value => { const u = new URL(value); return u.protocol === 'https:' && (u.hostname.endsWith('.gov.in') || u.hostname.endsWith('.nic.in')); }, 'A government source URL is required');
const ring = z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).min(4);
const boundary = z.discriminatedUnion('type', [z.object({ type: z.literal('Polygon'), coordinates: z.array(ring).min(1) }), z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(z.array(ring).min(1)).min(1) })]);
const wardImport = z.array(z.object({ coverage_id: z.string().min(1), identifier: z.string().min(1), name: z.string().min(1), corporation: z.string().min(1), boundary, source_url: officialUrl, verified_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), representative: z.string().optional(), representative_source_url: officialUrl.optional() }).refine(v => !v.representative || !!v.representative_source_url, 'Representatives require their own source')).min(1).max(500);
function DirectoryPage() {
  const roles = useRoles();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['civic-directory'], queryFn: () => getDirectory() });
  const [input, setInput] = useState('');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!roles.data?.roles.includes('admin')) return <p className="p-8">Administrator access required.</p>;
  async function importWards() {
    if (!verified || busy) return;
    setBusy(true);
    try {
      const rows = wardImport.parse(JSON.parse(input));
      const { error } = await supabase.from('civic_wards').upsert(rows, { onConflict: 'coverage_id,identifier' });
      if (error) throw error;
      toast.success(`${rows.length} verified ward records saved.`); setInput(''); setVerified(false);
      await qc.invalidateQueries({ queryKey: ['civic-directory'] });
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Import failed'); } finally { setBusy(false); }
  }
  return <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-8">
    <div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Routing & provenance</p><h1 className="mt-2 text-3xl font-bold">Authority directory</h1><p className="mt-2 text-sm text-muted-foreground">Official contacts are not proof of asset ownership or government delivery.</p></div>
    <div className="flex flex-wrap gap-8 border-y py-4"><p><strong className="text-2xl">{query.data?.authorities.length ?? '—'}</strong> service authorities</p><p><strong className="text-2xl">{query.data?.wards.length ?? '—'}</strong> verified wards</p><p className="text-warning-foreground">Bengaluru coverage: partial</p></div>
    {query.isError && <p role="alert">Directory could not be loaded.</p>}
    <section className="space-y-0 divide-y">{query.data?.authorities.map(a => <article key={a.id} className="py-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{a.name}</h2><a className="inline-flex items-center gap-1 text-sm text-primary" href={a.source_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Official source</a></div><p className="mt-2 text-sm text-muted-foreground">{a.notes}</p><p className="mt-2 flex items-center gap-1 text-xs text-primary"><ShieldCheck className="h-3 w-3" />Source reviewed {a.verified_at}</p></article>)}</section>
    <section className="space-y-4 border-t pt-6"><h2 className="text-xl font-semibold">Import verified ward boundaries</h2><p className="text-sm text-muted-foreground">Use current government boundaries only. Legacy BBMP ward lists must not be treated as the five corporations’ current boundaries.</p><textarea aria-label="Verified ward records" value={input} onChange={e => setInput(e.target.value)} rows={9} maxLength={2000000} placeholder='[{"coverage_id":"bengaluru","identifier":"...","name":"...","corporation":"...","boundary":{"type":"Polygon","coordinates":[...]},"source_url":"https://...gov.in/...","verified_at":"YYYY-MM-DD"}]' className="w-full rounded-lg border bg-card p-3 font-mono text-xs" /><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} className="mt-1" />I have verified the dataset’s effective date and legal boundaries against the official source.</label><Button disabled={!verified || !input.trim() || busy} onClick={importWards}><Upload className="h-4 w-4" />{busy ? 'Importing…' : 'Validate and import'}</Button></section>
  </div>;
}