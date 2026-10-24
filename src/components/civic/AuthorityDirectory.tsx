import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, ExternalLink, Phone, Search, ShieldCheck, ArrowRight } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { getDirectory } from '@/lib/directory.functions';
import { CATEGORIES } from '@/lib/civic';

export function AuthorityDirectory({ compact = false }: { compact?: boolean }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const query = useQuery({ queryKey: ['civic-directory'], queryFn: () => getDirectory(), staleTime: 300000 });
  const authorities = query.data?.authorities.filter(a => a.coverage_id === 'bengaluru' &&
    (category === 'all' || query.data?.rules.some(r => r.authority_id === a.id && r.category === category)) &&
    `${a.name} ${a.notes} ${a.kind}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  return <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Bengaluru · public service directory</p><h2 className="mt-2 text-2xl font-bold">Who handles what?</h2><p className="mt-2 text-sm text-muted-foreground">Official service contacts, complaint channels and responsibility boundaries.</p></div>
      {compact && <Button asChild variant="outline"><Link to="/authorities">All contacts & responsibilities<ArrowRight className="h-4 w-4" /></Link></Button>}
    </div>
    {!compact && <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]"><label className="relative flex min-w-0 items-center"><Search className="absolute left-3 h-4 w-4 text-muted-foreground" /><input aria-label="Search authorities" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search a service or authority" className="h-11 w-full rounded-lg border bg-card pl-10 pr-3 text-sm" /></label><select aria-label="Service category" value={category} onChange={e => setCategory(e.target.value)} className="h-11 max-w-full rounded-lg border bg-card px-3 text-sm"><option value="all">All services</option>{CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>}
    {query.isLoading ? <p className="py-8 text-muted-foreground">Loading official contacts…</p> : query.isError ? <div role="alert" className="py-8"><p>Official contacts could not be loaded.</p><Button variant="outline" onClick={() => query.refetch()}>Retry</Button></div> : <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {authorities.map(a => <article key={a.id} className="flex min-w-0 flex-col rounded-lg border bg-card p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase text-primary"><Building2 className="h-4 w-4" />{a.kind}</div>
        <h3 className="mt-3 text-lg font-semibold leading-snug">{a.name}</h3>
        <div className="mt-3 flex flex-wrap gap-1.5">{CATEGORIES.filter(c => query.data?.rules.some(r => r.authority_id === a.id && r.category === c.id)).map(c => <span key={c.id} className="bg-secondary px-2 py-1 text-xs text-secondary-foreground">{c.label}</span>)}</div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a.notes}</p>
        <div className="mt-auto pt-5"><div className="flex flex-wrap gap-2">{a.phone && <Button asChild variant="outline" size="sm"><a href={`tel:${a.phone}`}><Phone className="h-4 w-4" />{a.phone}</a></Button>}{a.reporting_url && <Button asChild size="sm"><a href={a.reporting_url} target="_blank" rel="noopener noreferrer">Complaint channel<ExternalLink className="h-3 w-3" /></a></Button>}</div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3 text-xs"><a href={a.website_url} target="_blank" rel="noopener noreferrer" className="text-primary">Official website ↗</a><a href={a.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-muted-foreground"><ShieldCheck className="h-3 w-3" />Source reviewed {a.verified_at}</a></div></div>
      </article>)}
    </div>}
    {!query.isLoading && !query.isError && authorities.length === 0 && <p className="py-8 text-muted-foreground">No matching authority. Try another service or search.</p>}
    <p className="mt-5 text-xs text-muted-foreground">Contacts are indicative service routes, not confirmed ownership of a specific asset. CivicFix does not send government complaints automatically.</p>
  </section>;
}