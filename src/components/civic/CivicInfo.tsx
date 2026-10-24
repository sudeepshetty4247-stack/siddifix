import { useQuery } from '@tanstack/react-query';
import { Building2, Landmark, MapPin, Phone, ShieldCheck, UserRound, Users, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { getDirectory } from '@/lib/directory.functions';
import { resolveCivicRouting } from '@/lib/directory';
import { departmentFor, findWard, loadWards, WARD_SOURCE_LABEL } from '@/lib/wards';
import { Button } from '@/components/ui/button';

function Step({ icon, label, title, children, last }: { icon: ReactNode; label: string; title: ReactNode; children?: ReactNode; last?: boolean }) {
  return <li className="relative flex gap-3 pb-4">
    {!last && <span className="absolute left-4 top-9 h-[calc(100%-2.25rem)] w-px bg-border" aria-hidden />}
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">{icon}</span>
    <div className="min-w-0 flex-1"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="text-sm font-semibold">{title}</p>{children}</div>
  </li>;
}
const Call = ({ n }: { n: string }) => <Button asChild size="sm" variant="outline" className="mt-1.5 h-7 text-xs"><a href={`tel:${n}`}><Phone className="h-3 w-3" />{n}</a></Button>;

export function CivicInfo({ lat, lng, category, subcategory }: { lat: number; lng: number; category?: string; subcategory?: string | null }) {
  const dir = useQuery({ queryKey: ['civic-directory'], queryFn: () => getDirectory(), staleTime: 300000 });
  const wards = useQuery({ queryKey: ['bengaluru-wards'], queryFn: loadWards, staleTime: Infinity });
  if (wards.isLoading || dir.isLoading) return <p className="py-4 text-sm text-muted-foreground">Finding the ward and responsible offices…</p>;
  const ward = wards.data ? findWard(wards.data, lat, lng) : null;
  const routing = dir.data ? resolveCivicRouting(dir.data, lat, lng, category, subcategory ?? undefined) : null;
  const dept = departmentFor(category);
  return <section className="space-y-4 border-t py-5">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><Building2 className="h-5 w-5 text-primary" />Responsibility chain</h2>
    {wards.isError && <div className="text-sm"><p>The ward map could not load.</p><Button variant="ghost" onClick={() => wards.refetch()}>Try again</Button></div>}
    {!wards.isError && !ward && <p className="text-sm text-muted-foreground">This location is outside the 369 Greater Bengaluru wards. You can still report and track it here.</p>}
    {ward && <ol>
      <Step icon={<MapPin className="h-4 w-4" />} label={`Ward ${ward.no}`} title={<>{ward.name}{ward.name_kn && <span className="ml-1.5 font-normal text-muted-foreground">· {ward.name_kn}</span>}</>}>
        <p className="text-xs text-muted-foreground">Population {ward.population.toLocaleString('en-IN')} · Zone {ward.zone}</p>
      </Step>
      <Step icon={<Landmark className="h-4 w-4" />} label="City corporation" title={ward.corporation}>
        <p className="text-xs text-muted-foreground">Under the Greater Bengaluru Authority. Corporation control room:</p><Call n="1533" />
      </Step>
      <Step icon={<Wrench className="h-4 w-4" />} label="Responsible office (indicative)" title={dept.office}>
        <p className="text-xs text-muted-foreground">Officer: {dept.role} for {ward.name}. Officer names are not published for every ward, so we show the role only.</p>
        {dept.helpline && <Call n={dept.helpline} />}
      </Step>
      <Step icon={<UserRound className="h-4 w-4" />} label={`MLA · ${ward.ac_no} ${ward.ac}`} title={<>{ward.mla} <span className="font-normal text-muted-foreground">({ward.mla_party})</span></>} />
      <Step icon={<Users className="h-4 w-4" />} label={`MP · ${ward.ls}`} title={ward.mp} />
      <Step last icon={<UserRound className="h-4 w-4" />} label="Ward corporator" title="No elected corporator yet">
        <p className="text-xs text-muted-foreground">Corporation elections are pending, so the ward is run by appointed officials.</p>
      </Step>
    </ol>}
    {routing && routing.candidates.length > 0 && <div className="space-y-2 rounded-lg bg-muted/50 p-3">
      <p className="text-xs font-medium text-muted-foreground">Service agencies for this issue type</p>
      {routing.candidates.map(a => <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{a.name}</span>{a.phone && <a className="text-xs text-primary" href={`tel:${a.phone}`}>{a.phone}</a>}</div>)}
    </div>}
    {ward && <p className="flex items-start gap-1 text-[11px] text-muted-foreground"><ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />Ward: <a className="text-primary" href="https://data.opencity.in/dataset/gba-wards-delimitation-2025" target="_blank" rel="noopener noreferrer">{WARD_SOURCE_LABEL}</a>. Representatives: Election Commission results (Assembly 2023, Lok Sabha 2024). Checked 24 Oct 2026.</p>}
    <p className="text-xs text-muted-foreground">Authority names are indicative. CivicFix manages this case itself; these offices have not accepted it unless the history shows so.</p>
  </section>;
}
