import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Building2, Inbox, Landmark, MapPin, Phone, ShieldCheck, UserRound, Users, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { getDirectory } from '@/lib/directory.functions';
import { resolveCivicRouting, type CivicRouting } from '@/lib/directory';
import { Button } from '@/components/ui/button';

function Step({ icon, label, title, children, last }: { icon: ReactNode; label: string; title: ReactNode; children?: ReactNode; last?: boolean }) {
  return <li className="relative flex gap-3 pb-4">
    {!last && <span className="absolute left-4 top-9 h-[calc(100%-2.25rem)] w-px bg-border" aria-hidden />}
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">{icon}</span>
    <div className="min-w-0 flex-1"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p><div className="text-sm font-semibold">{title}</div>{children}</div>
  </li>;
}
const Call = ({ n, label }: { n: string; label?: string | null }) => <Button asChild size="sm" variant="outline" className="mt-1.5 h-7 text-xs"><a href={`tel:${n}`}><Phone className="h-3 w-3" />{label ? `${label} · ` : ''}{n}</a></Button>;
const Needs = () => <span className="ml-1 inline-flex items-center gap-1 rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning-foreground"><AlertTriangle className="h-3 w-3" />Verification required</span>;

/** Pass `snapshot` to show the responsibility recorded when the report was filed. */
export function CivicInfo({ lat, lng, category, subcategory, snapshot }: { lat: number; lng: number; category?: string; subcategory?: string | null; snapshot?: unknown }) {
  const dir = useQuery({ queryKey: ['civic-directory'], queryFn: () => getDirectory(), staleTime: 300000 });
  if (dir.isLoading) return <p className="py-4 text-sm text-muted-foreground">Finding the ward and responsible offices…</p>;
  if (dir.isError || !dir.data) return <div className="py-4 text-sm"><p>Local civic information is unavailable.</p><Button variant="ghost" onClick={() => dir.refetch()}>Try again</Button></div>;
  const routing = resolveCivicRouting(dir.data, lat, lng, category, subcategory ?? undefined);
  const { ward, route } = routing;
  const recorded = snapshot as Partial<CivicRouting> | null | undefined;
  const recordedWard = recorded?.ward;
  const changed = recordedWard && ward && (recordedWard.identifier !== ward.identifier || recordedWard.corporation !== ward.corporation);
  return <section className="space-y-4 border-t py-5">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><Building2 className="h-5 w-5 text-primary" />Responsibility chain</h2>
    {routing.reviewReason && <p role="status" className="text-sm text-warning-foreground">{routing.reviewReason}</p>}
    {dir.data.wards.length === 0 && <p className="text-sm text-muted-foreground">Ward records haven't been loaded into CivicFix yet. Staff will add them shortly.</p>}
    {dir.data.wards.length > 0 && !ward && <p className="text-sm text-muted-foreground">This location is outside the Greater Bengaluru wards on record. You can still report and track it here.</p>}
    {changed && <p className="rounded-lg bg-muted p-2 text-xs">When reported, this case was recorded in ward {recordedWard.ward_number ?? ''} {recordedWard.name} ({recordedWard.corporation}). Showing the latest directory below.</p>}
    {ward && <div className="space-y-4"><div className="border-b pb-4 text-center"><p className="text-xs text-muted-foreground">Know your ward</p><h3 className="mt-1 text-lg font-semibold">{ward.name} · #{ward.ward_number ?? ward.identifier}</h3><p className="mt-1 text-xs text-muted-foreground">{ward.corporation}</p></div><ol>
      <Step icon={<MapPin className="h-4 w-4" />} label={`Ward ${ward.ward_number ?? ward.identifier}`} title={<>{ward.name}{ward.name_kn && <span className="ml-1.5 font-normal text-muted-foreground">· {ward.name_kn}</span>}{ward.verification_status !== 'verified' && <Needs />}</>}>
        <p className="text-xs text-muted-foreground">{[ward.zone && `Zone ${ward.zone}`, ward.population && `Population ${ward.population.toLocaleString('en-IN')} (delimitation data)`].filter(Boolean).join(' · ')}</p>
        {!ward.zone && <p className="text-xs text-warning-foreground">Zone not verified — manual review required.</p>}
        <p className="mt-1 text-xs text-muted-foreground">Published snapshot: {ward.source_published_at ?? 'Unknown'} · Source checked: {ward.source_checked_at?.slice(0, 10) ?? ward.verified_at}. Current jurisdiction requires review.</p>
      </Step>
      <Step icon={<Landmark className="h-4 w-4" />} label="City corporation" title={ward.corporation}><p className="text-xs text-muted-foreground">Under the Greater Bengaluru Authority.</p></Step>
    </ol><div className="grid grid-cols-2 gap-4"><div className="min-w-0"><h3 className="mb-4 text-xs font-semibold uppercase text-primary">Officers & services</h3><ol>
      <Step icon={<Building2 className="h-4 w-4" />} label="Greater Bengaluru Authority" title="Chief Commissioner"><p className="mt-1 text-xs text-muted-foreground">Current officeholder and portrait not verified.</p></Step>
      <Step icon={<Landmark className="h-4 w-4" />} label="City corporation" title="Commissioner"><p className="mt-1 text-xs text-muted-foreground">{ward.corporation}</p><p className="mt-1 text-xs text-muted-foreground">Current name, photograph and direct contact not verified.</p></Step>
      {route && <>
        <Step icon={<Inbox className="h-4 w-4" />} label="Receives complaints (indicative)" title={<>{route.receiving_office}{route.verification_status !== 'verified' && <Needs />}</>}>
          {route.verification_status === 'verified' && route.contact_phone && <Call n={route.contact_phone} label={route.contact_label} />}
          <p className="mt-1 text-[11px] text-muted-foreground">A helpline is a contact option; CivicFix is not connected to it.</p>
        </Step>
        <Step icon={<Wrench className="h-4 w-4" />} label="Fixes the problem (indicative)" title={route.fixing_team}>
          <p className="text-xs text-muted-foreground">Officer role: {route.officer_role}. Individual names are shown only once verified.</p>
          {route.notes && <p className="text-xs text-muted-foreground">{route.notes}</p>}
        </Step>
      </>}
      <Step icon={<UserRound className="h-4 w-4" />} label={`MLA${ward.assembly ? ` · ${ward.assembly_no} ${ward.assembly}` : ''}`} title={ward.representative_status === 'verified' && ward.mla ? <>{ward.mla} <span className="font-normal text-muted-foreground">({ward.mla_party})</span></> : <Needs />} />
      <Step icon={<Users className="h-4 w-4" />} label={`MP${ward.lok_sabha ? ` · ${ward.lok_sabha}` : ''}`} title={ward.representative_status === 'verified' && ward.mp ? ward.mp : <Needs />} />
      <Step last icon={<UserRound className="h-4 w-4" />} label="Ward corporator" title={ward.representative_status === 'verified' && ward.representative ? ward.representative : <Needs />} />
    </ol></div></div></div>}
    {ward && <p className="flex items-start gap-1 text-[11px] text-muted-foreground"><ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" /><span>Ward boundary: <a className="text-primary" href={ward.source_url} target="_blank" rel="noopener noreferrer">official delimitation data</a>{ward.representative_source_url && <> · Representatives: <a className="text-primary" href={ward.representative_source_url} target="_blank" rel="noopener noreferrer">Election Commission</a></>}</span></p>}
    <p className="text-xs text-muted-foreground">Authority names are indicative. CivicFix manages this case itself; these offices have not accepted it unless the history shows so.</p>
  </section>;
}
