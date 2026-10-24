import { useQuery } from '@tanstack/react-query';
import { Building2, ExternalLink, Phone, ShieldCheck } from 'lucide-react';
import { getDirectory } from '@/lib/directory.functions';
import { resolveCivicRouting } from '@/lib/directory';
import { Button } from '@/components/ui/button';

export function CivicInfo({ lat, lng, category, subcategory }: { lat: number; lng: number; category?: string; subcategory?: string | null }) {
  const query = useQuery({ queryKey: ['civic-directory'], queryFn: () => getDirectory(), staleTime: 300000 });
  if (query.isLoading) return <p className="py-4 text-sm text-muted-foreground">Loading local civic information…</p>;
  if (query.isError || !query.data) return <div className="py-4 text-sm"><p>Local civic information is unavailable.</p><Button variant="ghost" onClick={() => query.refetch()}>Try again</Button></div>;
  const routing = resolveCivicRouting(query.data, lat, lng, category, subcategory ?? undefined);
  return <section className="space-y-4 border-t py-5">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><Building2 className="h-5 w-5 text-primary" />Local Civic Information</h2>
    <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">Coverage</dt><dd>{routing.coverage ? 'Partially supported' : 'Community reporting'}</dd></div><div><dt className="text-xs text-muted-foreground">Ward / corporation</dt><dd>{routing.ward ? `${routing.ward.name} · ${routing.ward.corporation}` : 'Not verified'}</dd></div><div className="col-span-2"><dt className="text-xs text-muted-foreground">Elected representative</dt><dd>{routing.ward?.representative ?? 'Not verified'}</dd></div></dl>
    <p className="text-xs text-muted-foreground">{routing.coverage?.notice ?? 'You can report and track issues here. Verified local authority data is not yet available.'}</p>
    <p className="text-xs font-medium text-warning-foreground">Asset owner not verified · ownership review needed</p>
    {routing.candidates.length === 0 && <p className="text-sm text-muted-foreground">No verified service route for this category and area yet.</p>}
    {routing.candidates.map(a => <article key={a.id} className="space-y-2 border-l-2 border-primary pl-3">
      <h3 className="text-sm font-semibold">{a.name}</h3><p className="text-xs text-muted-foreground">{a.notes}</p>
      <div className="flex flex-wrap gap-2">{a.reporting_url && <Button asChild size="sm" variant="outline"><a href={a.reporting_url} target="_blank" rel="noopener noreferrer">Official route<ExternalLink className="h-3 w-3" /></a></Button>}{a.phone && <Button asChild size="sm" variant="ghost"><a href={`tel:${a.phone}`}><Phone className="h-3 w-3" />{a.phone}</a></Button>}</div>
      <a href={a.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-primary"><ShieldCheck className="h-3 w-3" />Source checked {a.verified_at} · view source</a>
    </article>)}
    <p className="text-xs text-muted-foreground">Opening an official route does not send your CivicFix report. No external submission is recorded.</p>
  </section>;
}