import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Download, FileText, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CATEGORIES, STATUSES, STATUS_META, SEVERITIES } from '@/lib/civic';
import { getReportSnapshot } from '@/lib/transparency.functions';
import { EMPTY_FILTERS, filterSummary, METHODOLOGY, type ReportFilters } from '@/lib/report-snapshot';
import { useShowcase } from '@/lib/showcase';
import { downloadReport, reportLabel } from '@/lib/report-export';
import fontUrl from '@fontsource/public-sans/files/public-sans-latin-400-normal.woff?url';

export function ReportWorkspace() {
  const [filters,setFilters]=useState<ReportFilters>(EMPTY_FILTERS);const [draft,setDraft]=useState<ReportFilters>(EMPTY_FILTERS);
  const [exporting,setExporting]=useState('');const [error,setError]=useState('');
  const [ready,setReady]=useState<{blob:Blob;name:string}|null>(null);
  const { showcase } = useShowcase();
  const q=useQuery({queryKey:['report-snapshot',filters,showcase],queryFn:()=>getReportSnapshot({data:{...filters,include_demo:showcase}}),staleTime:30000});
  const r=q.data;
  async function prepare(kind:'pdf'|'xlsx') {
    if(!r||exporting)return;setExporting(kind);setError('');setReady(null);
    const snapshot=structuredClone(r);const id=`SIDDHI-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
    try {
      const {buildReportPdf,buildReportWorkbook}=await import('@/lib/report-export');
      let blob:Blob;
      if(kind==='pdf'){const response=await fetch(fontUrl);if(!response.ok)throw new Error('Report font could not load. Please retry.');blob=await buildReportPdf(snapshot,id,new Uint8Array(await response.arrayBuffer()));}
      else blob=await buildReportWorkbook(snapshot,id);
      if(!blob.size)throw new Error('Generated file was empty. Please retry.');
      setReady({blob,name:`${id}.${kind}`});
    }catch(e){setError(e instanceof Error?e.message:'Export failed. Please retry.');}finally{setExporting('');}
  }
  const change=(key:keyof ReportFilters,value:string)=>{setDraft(f=>({...f,[key]:value}));setReady(null);};
  return <section className="border-y py-8" aria-label="Civic intelligence workspace">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold">Civic intelligence reports</h2><p className="mt-2 text-sm text-muted-foreground">Siddhi recorded service-area snapshot</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!r||!!exporting||q.isFetching} onClick={()=>prepare('pdf')}><FileText className="h-4 w-4"/>{exporting==='pdf'?'Preparing PDF…':'Prepare PDF'}</Button><Button disabled={!r||!!exporting||q.isFetching} onClick={()=>prepare('xlsx')}><Download className="h-4 w-4"/>{exporting==='xlsx'?'Preparing Excel…':'Prepare Excel'}</Button></div></div>
    <form className="my-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={e=>{e.preventDefault();setFilters({...draft});setReady(null);}}>
      {(['start','end'] as const).map(key=><label key={key} className="text-xs font-medium">{key==='start'?'From (IST)':'Through (IST)'}<input type="date" aria-label={key==='start'?'Report start date':'Report end date'} className="mt-1 h-10 w-full rounded-md border bg-card px-3" value={draft[key]?.slice(0,10)??''} onChange={e=>{const next={...draft};if(!e.target.value)delete next[key];else next[key]=`${e.target.value}T${key==='end'?'23:59:59.999':'00:00:00.000'}+05:30`;setDraft(next);setReady(null);}}/></label>)}
      {([
        ['category','Category',[['','All categories'],...CATEGORIES.map(c=>[c.id,c.label])]],
        ['status','Status',[['','All statuses'],...STATUSES.map(s=>[s,STATUS_META[s].label])]],
        ['severity','Severity',[['','All severities'],...SEVERITIES.map(s=>[s,s])]],
        ['resolution','Resolution',[['','All outcomes'],['resolved','Resolved / closed'],['unresolved','Not resolved / closed']]],
        ['records','Counting scope',[['canonical','Canonical cases'],['linked','Linked duplicate reports'],['all','All actual submissions']]],
      ] as [Exclude<keyof ReportFilters, 'include_demo'>,string,string[][]][]).map(([key,label,values])=><label key={key} className="text-xs font-medium">{label}<select aria-label={`Report ${label}`} value={draft[key]??''} onChange={e=>change(key,e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-card px-3">{values.map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label>)}
      <label className="text-xs font-medium">Corporation<input aria-label="Report corporation" placeholder="Exact configured name" className="mt-1 h-10 w-full rounded-md border bg-card px-3" value={draft.corporation} onChange={e=>change('corporation',e.target.value)}/></label><label className="text-xs font-medium">Ward identifier<input aria-label="Report ward" placeholder="e.g. south-60" className="mt-1 h-10 w-full rounded-md border bg-card px-3" value={draft.ward} onChange={e=>change('ward',e.target.value)}/></label>
      <div className="flex items-end gap-2"><Button type="submit">Apply filters</Button><Button type="button" variant="outline" aria-label="Reset report filters" title="Reset filters" onClick={()=>{setFilters(EMPTY_FILTERS);setDraft(EMPTY_FILTERS);setReady(null);}}><RotateCcw className="h-4 w-4"/></Button><Button type="button" variant="ghost" aria-label="Refresh snapshot" disabled={q.isFetching} onClick={()=>{setReady(null);void q.refetch();}}><RefreshCw className="h-4 w-4"/></Button></div>
    </form>
    <p className="break-words text-xs text-muted-foreground">Applied: {filterSummary(filters)}{r&&` · Snapshot ${new Date(r.generated_at).toLocaleString('en-IN')}`}</p>
    {ready&&<Button className="mt-4" onClick={()=>downloadReport(ready.blob,ready.name)}><Download className="h-4 w-4"/>Download {ready.name.endsWith('.pdf')?'PDF':'Excel'} ({Math.ceil(ready.blob.size/1024)} KB)</Button>}
    {error&&<p className="mt-3 text-sm text-warning-foreground" role="alert">{error}</p>}
    {q.isPending&&<p role="status" className="py-8">Loading current report…</p>}
    {q.isError&&<div role="alert" className="py-8"><p>{q.error.message}</p><Button variant="outline" onClick={()=>q.refetch()}>Retry</Button></div>}
    {r&&<><div className="my-7 grid grid-cols-2 gap-y-5 sm:grid-cols-4">{[['Records',r.summary.total],['Active',r.summary.active],['Resolved / closed',r.summary.resolved],['Citizen-confirmed',r.summary.citizen_confirmed],['Awaiting acknowledgement',r.summary.awaiting_acknowledgement],['In progress',r.summary.in_progress],['Awaiting verification',r.summary.awaiting_verification],['Overdue',r.summary.overdue],['Unassigned',r.summary.unassigned],['Routing exceptions',r.summary.routing_exceptions],['Reopened',r.summary.reopened],['Linked duplicates',r.summary.linked_duplicates]].map(([label,value])=><div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value}</p></div>)}</div>
      {!r.summary.total&&<p className="border-y py-6 text-sm text-muted-foreground">No recorded reports match these filters. Rates and measured durations remain unavailable rather than zero.</p>}
      <div className="grid gap-x-8 gap-y-7 lg:grid-cols-2">{['category','status','severity','ward','corporation'].map(d=>{const rows=r.groups.filter(g=>g.dimension===d);return <section key={d} className="min-w-0 border-t pt-5"><h3 className="mb-4 text-lg font-semibold capitalize">Reports by {d}</h3>{rows.length?<><div className="h-72" role="img" aria-label={`Reports by ${d}. Values listed below.`}><ResponsiveContainer width="100%" height="100%"><BarChart data={rows.slice(0,10).map(g=>({...g,label:reportLabel(d,g.key,g.label)}))} layout="vertical" margin={{left:0,right:20}}><CartesianGrid stroke="var(--border)" horizontal={false}/><XAxis type="number" allowDecimals={false}/><YAxis dataKey="label" type="category" width={140} tick={{fontSize:11}}/><Tooltip/><Bar dataKey="total" name="Records" fill="var(--chart-1)"/></BarChart></ResponsiveContainer></div><div className="max-h-48 overflow-auto"><table className="w-full text-sm"><thead><tr><th className="text-left">Classification</th><th className="text-right">Records</th></tr></thead><tbody>{rows.map(g=><tr key={g.key} className="border-t"><td className="py-2">{d==='category'?CATEGORIES.find(c=>c.id===g.key)?.label:d==='status'?STATUS_META[g.key as keyof typeof STATUS_META]?.label:g.label}</td><td className="text-right tabular-nums">{g.total}</td></tr>)}</tbody></table></div>{rows.length>10&&<p className="mt-2 text-xs text-muted-foreground">Chart shows top 10; the table and exports include all {rows.length} groups.</p>}</>:<p className="py-10 text-sm text-muted-foreground">No data for this chart.</p>}</section>;})}</div>
      <div className="mt-7 grid gap-8 lg:grid-cols-2"><section className="min-w-0 border-t pt-5"><h3 className="text-lg font-semibold">Submission trend (IST)</h3>{r.trend.length?<div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={r.trend}><XAxis dataKey="period" tick={{fontSize:10}}/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="reports" name="Submitted records" fill="var(--chart-1)"/><Bar dataKey="resolved" name="Currently resolved cohort" fill="var(--chart-4)"/></BarChart></ResponsiveContainer></div>:<p className="py-10 text-sm text-muted-foreground">No submission history in this scope.</p>}</section><section className="min-w-0 border-t pt-5"><h3 className="text-lg font-semibold">Resolution composition</h3>{r.summary.total?<><div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={[{label:'Resolved / closed',count:r.summary.resolved},{label:'Not resolved / closed',count:r.summary.total-r.summary.resolved}]}><XAxis dataKey="label" tick={{fontSize:10}}/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="count" name="Records" fill="var(--chart-4)"/></BarChart></ResponsiveContainer></div><p className="text-xs text-muted-foreground">Denominator: {r.summary.total} filtered records. Not resolved includes rejected records; active is shown separately.</p></>:<p className="py-10 text-sm text-muted-foreground">No denominator — no resolution percentage.</p>}</section></div>
      <section className="mt-7 border-t pt-5"><h3 className="text-lg font-semibold">Response & resolution</h3><p className="mt-3 text-sm">Mean response: {r.summary.average_response_hours??'Not measured'} {r.summary.average_response_hours!==null?'hours':''} ({r.summary.response_samples} valid timestamps). Mean resolution: {r.summary.average_resolution_days??'Not measured'} {r.summary.average_resolution_days!==null?'days':''} ({r.summary.resolution_samples} valid timestamps).</p></section>
    </>}
    <details className="mt-7 border-t pt-5"><summary className="cursor-pointer font-semibold">Methodology & data limitations</summary><ul className="mt-4 space-y-3 text-xs leading-relaxed text-muted-foreground">{METHODOLOGY.map(n=><li key={n}>{n}</li>)}</ul></details>
  </section>;
}