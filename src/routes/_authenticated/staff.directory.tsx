import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Download, Pencil, Search } from 'lucide-react';
import { z } from 'zod';
import { getDirectory } from '@/lib/directory.functions';
import type { DepartmentRoute, Ward } from '@/lib/directory';
import { CORPORATIONS, fileToRows, loadWardFile, validateWardSet } from '@/lib/wards';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRoles } from './staff';
import { PeopleDirectoryEditor } from '@/components/civic/PeopleDirectoryEditor';

export const Route = createFileRoute('/_authenticated/staff/directory')({
  head: () => ({ meta: [{ title: 'Authority directory management — CivicFix' }, { name: 'description', content: 'Manage verified ward, department and representative records.' }, { property: 'og:title', content: 'Authority directory management — CivicFix' }, { property: 'og:description', content: 'CivicFix authority directory management.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' }] }),
  component: DirectoryPage,
});

const STATUS = ['verified', 'verification_required', 'flagged'] as const;
const url = z.string().url().refine(v => v.startsWith('https://'), 'Use an https source link');
const ring = z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).min(4);
const boundary = z.discriminatedUnion('type', [z.object({ type: z.literal('Polygon'), coordinates: z.array(ring).min(1) }), z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(z.array(ring).min(1)).min(1) })]);
const wardForm = z.object({
  name: z.string().trim().min(1).max(120), name_kn: z.string().trim().max(120).nullable(), corporation: z.enum(CORPORATIONS as [string, ...string[]]),
  zone: z.string().trim().max(80).nullable(), assembly_no: z.number().int().min(1).max(999).nullable(), assembly: z.string().trim().max(80).nullable(),
  mla: z.string().trim().max(120).nullable(), mla_party: z.string().trim().max(40).nullable(), lok_sabha: z.string().trim().max(80).nullable(), mp: z.string().trim().max(120).nullable(),
  representative: z.string().trim().max(120).nullable(), source_url: url, representative_source_url: url.nullable(), verified_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  verification_status: z.enum(STATUS), representative_status: z.enum(STATUS), notes: z.string().max(2000), active: z.boolean(),
});
const routeForm = z.object({ receiving_office: z.string().trim().min(1).max(200), fixing_team: z.string().trim().min(1).max(200), officer_role: z.string().trim().min(1).max(160), contact_label: z.string().trim().max(60).nullable(), contact_phone: z.string().trim().regex(/^[0-9+\- ]{3,20}$/, 'Digits only').nullable(), source_url: url.nullable(), verification_status: z.enum(STATUS), verified_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), notes: z.string().max(1000), active: z.boolean() });
const blank = (v: string) => (v.trim() === '' ? null : v.trim());
const badge = (s: string) => <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${s === 'verified' ? 'bg-success/15 text-success' : s === 'flagged' ? 'bg-destructive/10 text-destructive' : 'bg-warning/15 text-warning-foreground'}`}>{s.replace('_', ' ')}</span>;

function DirectoryPage() {
  const roles = useRoles();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['civic-directory'], queryFn: () => getDirectory() });
  const audit = useQuery({ queryKey: ['directory-audit'], queryFn: async () => { const r = await supabase.from('civic_directory_audit').select('*').order('created_at', { ascending: false }).limit(100); if (r.error) throw r.error; return r.data; } });
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(''); const [filter, setFilter] = useState('all');
  const [editWard, setEditWard] = useState<Ward | null>(null); const [editRoute, setEditRoute] = useState<DepartmentRoute | null>(null);
  const wards = query.data?.wards ?? [];
  const problems = useMemo(() => validateWardSet(wards), [wards]);
  const shown = wards.filter(w => (filter === 'all' || w.verification_status === filter || (filter === 'rep' && w.representative_status !== 'verified')) && `${w.ward_number} ${w.name} ${w.name_kn ?? ''} ${w.corporation} ${w.assembly ?? ''}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.corporation.localeCompare(b.corporation) || (a.ward_number ?? 0) - (b.ward_number ?? 0));
  if (roles.isLoading) return <p className="p-8">Checking access…</p>;
  if (!roles.data?.roles.includes('admin')) return <p className="p-8">Administrator access required.</p>;
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['civic-directory'] }), qc.invalidateQueries({ queryKey: ['directory-audit'] })]);

  async function importOfficial() {
    setBusy(true);
    try {
      const rows = fileToRows(await loadWardFile());
      const issues = validateWardSet(rows);
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase.from('civic_wards').upsert(rows.slice(i, i + 100), { onConflict: 'coverage_id,identifier', ignoreDuplicates: true });
        if (error) throw error;
      }
      toast.success(`Imported missing wards from the official file. ${issues.length} problems flagged for review; existing records were left unchanged.`);
      await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Import failed'); } finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
    <div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Routing & provenance</p><h1 className="mt-2 text-3xl font-bold">Authority directory</h1><p className="mt-2 text-sm text-muted-foreground">Every change is logged. Cases keep the responsibility recorded when they were filed.</p></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[['Wards on record', wards.length], ['Verified wards', wards.filter(w => w.verification_status === 'verified').length], ['Flagged wards', wards.filter(w => w.verification_status === 'flagged').length], ['Representatives to verify', wards.filter(w => w.representative_status !== 'verified').length]].map(([l, v]) => <div key={l} className="rounded-xl border bg-card p-4"><p className="text-2xl font-bold">{v}</p><p className="text-xs text-muted-foreground">{l}</p></div>)}
    </div>
    {query.isError && <p role="alert">Directory could not be loaded.</p>}
    <Tabs defaultValue="wards">
      <TabsList><TabsTrigger value="wards">Wards</TabsTrigger><TabsTrigger value="routes">Departments</TabsTrigger><TabsTrigger value="people">People</TabsTrigger><TabsTrigger value="validation">Validation</TabsTrigger><TabsTrigger value="audit">Change history</TabsTrigger></TabsList>
      <TabsContent value="people"><PeopleDirectoryEditor/></TabsContent>
      <TabsContent value="wards" className="space-y-4">
        {wards.length < 369 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4"><p className="text-sm">Load the 369 wards from the official GBA delimitation file (notified 19 Nov 2025). Only missing wards are added. Every record starts as “verification required”.</p><Button disabled={busy} onClick={importOfficial}><Download className="h-4 w-4" />{busy ? 'Importing…' : 'Import official wards'}</Button></div>}
        <div className="flex flex-wrap gap-2"><div className="relative min-w-60 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search ward, corporation, constituency" value={search} onChange={e => setSearch(e.target.value)} /></div>
          <select aria-label="Filter" className="rounded-md border bg-card px-3 text-sm" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All</option><option value="verified">Verified</option><option value="verification_required">Verification required</option><option value="flagged">Flagged</option><option value="rep">Representatives unverified</option></select></div>
        <div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead className="bg-muted text-left text-xs"><tr><th className="p-2">Ward</th><th className="p-2">Corporation</th><th className="p-2">Constituency</th><th className="p-2">Ward</th><th className="p-2">Reps</th><th /></tr></thead>
          <tbody>{shown.slice(0, 200).map(w => <tr key={w.id} className="border-t"><td className="p-2"><b>{w.ward_number}. {w.name}</b> <span className="text-muted-foreground">{w.name_kn}</span>{w.flags.length > 0 && <p className="text-[11px] text-destructive">{w.flags.join(', ').replaceAll('_', ' ')}</p>}{!w.active && <p className="text-[11px] text-muted-foreground">Deactivated</p>}</td><td className="p-2 text-xs">{w.corporation.replace(' City Corporation', '')}</td><td className="p-2 text-xs">{w.assembly_no} {w.assembly}</td><td className="p-2">{badge(w.verification_status)}</td><td className="p-2">{badge(w.representative_status)}</td><td className="p-2"><Button size="sm" variant="ghost" onClick={() => setEditWard(w)}><Pencil className="h-3 w-3" />Edit</Button></td></tr>)}</tbody></table>
          {shown.length > 200 && <p className="p-2 text-xs text-muted-foreground">Showing 200 of {shown.length}. Narrow the search.</p>}</div>
      </TabsContent>
      <TabsContent value="routes" className="space-y-3">
        <p className="text-sm text-muted-foreground">Who receives a complaint can differ from who physically fixes it. Helplines are contact options, not integrations.</p>
        {(query.data?.routes ?? []).map(r => <article key={r.id} className="rounded-xl border bg-card p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold capitalize">{r.category} {badge(r.verification_status)}</h3><Button size="sm" variant="ghost" onClick={() => setEditRoute(r)}><Pencil className="h-3 w-3" />Edit</Button></div><p className="mt-1 text-sm"><b>Receives:</b> {r.receiving_office}</p><p className="text-sm"><b>Fixes:</b> {r.fixing_team} · {r.officer_role}</p><p className="text-xs text-muted-foreground">{r.contact_label} {r.contact_phone} {r.notes}</p></article>)}
      </TabsContent>
      <TabsContent value="validation" className="space-y-3">
        {wards.length === 0 ? <p className="text-sm">No wards on record yet.</p> : problems.length === 0 ? <p className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-success" />No structural problems found in {wards.length} wards (count, IDs, corporations, sources, boundaries, official list match). Legal accuracy still needs human verification.</p> : <>
          <p className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-warning" />{problems.length} problems found. Records were not changed.</p>
          <ul className="max-h-96 space-y-1 overflow-y-auto rounded-xl border p-3 text-xs">{problems.map((p, n) => <li key={n}><b>{p.id}</b> — {p.message}</li>)}</ul></>}
        <p className="text-xs text-muted-foreground">Flags from import: “name differs from division list” compares map names with GBA’s ward–division list; “boundary had stray lines removed” means the source shape contained non-area lines.</p>
      </TabsContent>
      <TabsContent value="audit">
        <ul className="divide-y rounded-xl border">{(audit.data ?? []).map(a => { const n = a.new_row as Record<string, unknown> | null; return <li key={a.id} className="p-3 text-sm"><b>{a.action}</b> {a.table_name === 'civic_wards' ? 'ward' : 'department'} {String(n?.['name'] ?? n?.['category'] ?? '')} <span className="text-xs text-muted-foreground">· {new Date(a.created_at).toLocaleString('en-IN')}</span></li>; })}{audit.data?.length === 0 && <li className="p-3 text-sm text-muted-foreground">No changes yet.</li>}</ul>
      </TabsContent>
    </Tabs>
    {editWard && <WardEditor ward={editWard} onClose={() => setEditWard(null)} onSaved={refresh} />}
    {editRoute && <RouteEditor route={editRoute} onClose={() => setEditRoute(null)} onSaved={refresh} />}
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-1 text-xs font-medium"><span>{label}</span>{children}</label>; }

function WardEditor({ ward, onClose, onSaved }: { ward: Ward; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const [f, setF] = useState({ name: ward.name, name_kn: ward.name_kn ?? '', corporation: ward.corporation, zone: ward.zone ?? '', assembly_no: ward.assembly_no?.toString() ?? '', assembly: ward.assembly ?? '', mla: ward.mla ?? '', mla_party: ward.mla_party ?? '', lok_sabha: ward.lok_sabha ?? '', mp: ward.mp ?? '', representative: ward.representative ?? '', source_url: ward.source_url, representative_source_url: ward.representative_source_url ?? '', verified_at: ward.verified_at, verification_status: ward.verification_status, representative_status: ward.representative_status, notes: ward.notes, active: ward.active });
  const [geo, setGeo] = useState(''); const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  async function save() {
    setSaving(true);
    try {
      const v = wardForm.parse({ ...f, name_kn: blank(f.name_kn), zone: blank(f.zone), assembly_no: f.assembly_no ? Number(f.assembly_no) : null, assembly: blank(f.assembly), mla: blank(f.mla), mla_party: blank(f.mla_party), lok_sabha: blank(f.lok_sabha), mp: blank(f.mp), representative: blank(f.representative), representative_source_url: blank(f.representative_source_url) });
      if (v.representative_status === 'verified' && !v.representative_source_url) throw new Error('Verified representatives need a source link');
      const patch: Record<string, unknown> = { ...v };
      if (geo.trim()) patch['boundary'] = boundary.parse(JSON.parse(geo));
      if (v.verification_status === 'verified') patch['flags'] = [];
      const { error } = await supabase.from('civic_wards').update(patch as never).eq('id', ward.id);
      if (error) throw error;
      toast.success('Ward saved and logged.'); await onSaved(); onClose();
    } catch (e) { toast.error(e instanceof z.ZodError ? e.issues[0]?.message ?? 'Invalid input' : e instanceof Error ? e.message : 'Save failed'); } finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={o => !o && onClose()}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Ward {ward.ward_number} · {ward.identifier}</DialogTitle></DialogHeader>
    {ward.official_name && ward.official_name !== ward.name && <p className="text-xs text-muted-foreground">Official division list name: {ward.official_name}</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Name (English)"><Input value={f.name} onChange={set('name')} /></Field><Field label="Name (Kannada)"><Input value={f.name_kn} onChange={set('name_kn')} /></Field>
      <Field label="Corporation"><select className="h-10 w-full rounded-md border bg-card px-2 text-sm" value={f.corporation} onChange={set('corporation')}>{CORPORATIONS.map(c => <option key={c}>{c}</option>)}</select></Field><Field label="Zone"><Input value={f.zone} onChange={set('zone')} /></Field>
      <Field label="Assembly no."><Input inputMode="numeric" value={f.assembly_no} onChange={set('assembly_no')} /></Field><Field label="Assembly constituency"><Input value={f.assembly} onChange={set('assembly')} /></Field>
      <Field label="MLA"><Input value={f.mla} onChange={set('mla')} /></Field><Field label="MLA party"><Input value={f.mla_party} onChange={set('mla_party')} /></Field>
      <Field label="Lok Sabha constituency"><Input value={f.lok_sabha} onChange={set('lok_sabha')} /></Field><Field label="MP"><Input value={f.mp} onChange={set('mp')} /></Field>
      <Field label="Ward corporator (if elected)"><Input value={f.representative} onChange={set('representative')} /></Field><Field label="Representative source link"><Input value={f.representative_source_url} onChange={set('representative_source_url')} /></Field>
      <Field label="Ward source link"><Input value={f.source_url} onChange={set('source_url')} /></Field><Field label="Verified on"><Input type="date" value={f.verified_at} onChange={set('verified_at')} /></Field>
      <Field label="Ward status"><select className="h-10 w-full rounded-md border bg-card px-2 text-sm" value={f.verification_status} onChange={set('verification_status')}>{STATUS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></Field>
      <Field label="Representative status"><select className="h-10 w-full rounded-md border bg-card px-2 text-sm" value={f.representative_status} onChange={set('representative_status')}>{STATUS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></Field>
    </div>
    <Field label="Replace boundary (GeoJSON Polygon/MultiPolygon, optional)"><Textarea rows={3} className="font-mono text-xs" value={geo} onChange={e => setGeo(e.target.value)} /></Field>
    <Field label="Notes"><Textarea rows={2} value={f.notes} onChange={set('notes')} /></Field>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} />Active (untick to deactivate)</label>
    <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</Button></div>
  </DialogContent></Dialog>;
}

function RouteEditor({ route, onClose, onSaved }: { route: DepartmentRoute; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const [f, setF] = useState({ receiving_office: route.receiving_office, fixing_team: route.fixing_team, officer_role: route.officer_role, contact_label: route.contact_label ?? '', contact_phone: route.contact_phone ?? '', source_url: route.source_url ?? '', verification_status: route.verification_status, verified_at: route.verified_at ?? '', notes: route.notes, active: route.active });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  async function save() {
    setSaving(true);
    try {
      const v = routeForm.parse({ ...f, contact_label: blank(f.contact_label), contact_phone: blank(f.contact_phone), source_url: blank(f.source_url), verified_at: blank(f.verified_at) });
      if (v.verification_status === 'verified' && (!v.source_url || !v.verified_at)) throw new Error('Verified routes need a source link and date');
      const { error } = await supabase.from('civic_department_routes').update(v).eq('id', route.id); if (error) throw error;
      toast.success('Department saved and logged.'); await onSaved(); onClose();
    } catch (e) { toast.error(e instanceof z.ZodError ? e.issues[0]?.message ?? 'Invalid input' : e instanceof Error ? e.message : 'Save failed'); } finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={o => !o && onClose()}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle className="capitalize">{route.category}</DialogTitle></DialogHeader>
    <div className="grid gap-3">
      <Field label="Receives complaints"><Input value={f.receiving_office} onChange={set('receiving_office')} /></Field>
      <Field label="Fixes the problem"><Input value={f.fixing_team} onChange={set('fixing_team')} /></Field>
      <Field label="Officer job title"><Input value={f.officer_role} onChange={set('officer_role')} /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Contact label"><Input value={f.contact_label} onChange={set('contact_label')} /></Field><Field label="Contact number"><Input value={f.contact_phone} onChange={set('contact_phone')} /></Field></div>
      <div className="grid grid-cols-2 gap-3"><Field label="Official source link"><Input value={f.source_url} onChange={set('source_url')} /></Field><Field label="Verified on"><Input type="date" value={f.verified_at} onChange={set('verified_at')} /></Field></div>
      <Field label="Status"><select className="h-10 w-full rounded-md border bg-card px-2 text-sm" value={f.verification_status} onChange={set('verification_status')}>{STATUS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></Field>
      <Field label="Notes"><Textarea rows={2} value={f.notes} onChange={set('notes')} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} />Active</label>
    </div>
    <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</Button></div>
  </DialogContent></Dialog>;
}
