import { useQuery } from '@tanstack/react-query';
import { Building2, UserRound, Phone, Mail, MapPin, Landmark, Vote, ExternalLink } from 'lucide-react';
import { getLocalDirectory } from '@/lib/directory.functions';
import { resolveCivicRouting, type CivicRouting, type Ward } from '@/lib/directory';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AuthorityPortrait } from '@/components/civic/AuthorityPortrait';

const MP_SOURCE = 'https://results.eci.gov.in/PcResultGenJune2024/index.htm';
const MLA_SOURCE = 'https://results.eci.gov.in/ResultAcGenMay2023/partywiseresult-S10.htm';

type PortraitProfile = { kind: string; full_name: string; photo_url: string | null; photo_source_url: string | null };

function Elected({ role, name, party, area, source, portrait }: { role: string; name: string; party?: string | null; area?: string | null; source: string; portrait?: PortraitProfile }) {
  return <article className="flex items-center gap-3 rounded-xl border bg-card p-3">
    <AuthorityPortrait name={name} role={role} url={portrait?.photo_url} source={portrait?.photo_source_url} />
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{role}</p>
      <h4 className="truncate text-sm font-semibold">{name}</h4>
      <p className="text-xs text-muted-foreground">{[party, area].filter(Boolean).join(' · ')}</p>
      <a href={source} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-primary">Election Commission result<ExternalLink className="h-3 w-3" /></a>
    </div>
  </article>;
}

export function WardSummary({ ward, portraits = [] }: { ward: Omit<Ward, 'boundary'>; portraits?: PortraitProfile[] }) {
  const repsVerified = ward.representative_status === 'verified';
  const portraitFor = (kind: string, name: string) => portraits.find(p => p.kind === kind && p.full_name.trim().toLowerCase() === name.trim().toLowerCase());
  return <div className="space-y-3">
    <div className="rounded-xl bg-primary-soft p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Your ward</p>
      <p className="mt-1 font-display text-xl font-bold">{ward.name}{ward.ward_number ? ` · #${ward.ward_number}` : ''}</p>
      {ward.name_kn && <p className="text-sm text-muted-foreground">{ward.name_kn}</p>}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div><dt className="text-muted-foreground">Corporation</dt><dd className="font-medium">{ward.corporation}</dd></div>
        {ward.zone && <div><dt className="text-muted-foreground">Zone</dt><dd className="font-medium">{ward.zone}</dd></div>}
        {ward.assembly && <div><dt className="text-muted-foreground">Assembly constituency</dt><dd className="font-medium">{ward.assembly}{ward.assembly_no ? ` (${ward.assembly_no})` : ''}</dd></div>}
        {ward.lok_sabha && <div><dt className="text-muted-foreground">Lok Sabha constituency</dt><dd className="font-medium">{ward.lok_sabha}</dd></div>}
        {ward.population ? <div><dt className="text-muted-foreground">Population</dt><dd className="font-medium">{ward.population.toLocaleString('en-IN')}</dd></div> : null}
      </dl>
    </div>
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Vote className="h-4 w-4 text-primary" />Elected representatives</h3>
      {repsVerified && (ward.mla || ward.mp) ? <div className="grid gap-2 sm:grid-cols-2">
        {ward.mla && <Elected role="MLA" name={ward.mla} party={ward.mla_party} area={ward.assembly} source={ward.representative_source_url ?? MLA_SOURCE} portrait={portraitFor('mla', ward.mla)} />}
        {ward.mp && <Elected role="MP" name={ward.mp} area={ward.lok_sabha} source={MP_SOURCE} portrait={portraitFor('mp', ward.mp)} />}
      </div> : <p className="text-sm text-muted-foreground">MLA and MP details for this ward are awaiting verification.</p>}
      <div className="mt-2 flex items-center gap-3 rounded-xl border border-dashed p-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground"><UserRound className="h-5 w-5" /></span>
        <div><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Corporator</p><p className="text-sm font-medium">No elected corporator in office</p><p className="text-xs text-muted-foreground">Ward council elections for the new city corporations have not yet been held.</p></div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">MLA from the May 2023 Karnataka Assembly result, MP from the June 2024 Lok Sabha result, linked through this ward's official assembly constituency.</p>
    </div>
  </div>;
}

export function CivicInfo({lat,lng,category,subcategory,snapshot}:{lat:number;lng:number;category?:string;subcategory?:string|null;snapshot?:unknown}){
  const directory=useQuery({queryKey:['civic-directory',lat,lng],queryFn:()=>getLocalDirectory({data:{lat,lng}}),staleTime:300000});
  const localWard = directory.data ? resolveCivicRouting(directory.data,lat,lng,category,subcategory??undefined).ward : null;
  const people=useQuery({queryKey:['verified-civic-people',localWard?.identifier],enabled:!!localWard,queryFn:async()=>{if(!localWard)return [];const r=await supabase.from('civic_people').select('id,full_name,designation,kind,corporation,ward_identifier,category,zone,photo_url,photo_source_url,contact_phone,contact_email,source_url,checked_at').eq('verification_status','verified').eq('active',true).or(`ward_identifier.eq.${localWard.identifier},ward_identifier.is.null`);if(r.error)throw r.error;return r.data;},staleTime:300000});
  if(directory.isPending)return <p className="py-4 text-sm text-muted-foreground">Finding your ward and representatives…</p>;
  if(!directory.data)return <div className="py-4"><p className="text-sm">Local information is unavailable.</p><Button variant="outline" onClick={()=>directory.refetch()}>Try again</Button></div>;
  const routing=resolveCivicRouting(directory.data,lat,lng,category,subcategory??undefined);const {ward,route}=routing;
  if(!ward)return <section className="border-t py-5"><h2 className="text-lg font-semibold">Local responsibility</h2><p className="mt-2 text-sm text-muted-foreground">{routing.reviewReason??'No supported ward matches this point.'} Your report remains available for CivicFix ownership review.</p></section>;
  const relevant=(people.data??[]).filter(p=>(!p.ward_identifier||p.ward_identifier===ward.identifier)&&(!p.corporation||p.corporation===ward.corporation)&&(!p.category||p.category===category)&&(!p.zone||p.zone===ward.zone));
  const officers=relevant.filter(p=>p.kind==='operational'||p.kind==='leadership');
  const gba=directory.data.authorities.filter(a=>a.phone&&/Greater Bengaluru/i.test(a.name));
  const city=[...routing.candidates.filter(a=>a.phone),...gba].filter((a,i,all)=>all.findIndex(o=>o.id===a.id)===i).slice(0,3);
  const recorded=(snapshot as Partial<CivicRouting>|null)?.ward;
  function profile(p:(typeof relevant)[number]){return <article key={p.id} className="flex gap-3 rounded-xl border bg-card p-3"><AuthorityPortrait name={p.full_name} role={p.designation} url={p.photo_url} source={p.photo_source_url}/><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{p.designation}</p><h4 className="text-sm font-semibold">{p.full_name}</h4><div className="mt-2 flex flex-wrap gap-2">{p.contact_phone&&<Button asChild size="sm" variant="outline"><a href={`tel:${p.contact_phone}`}><Phone className="h-3 w-3"/>{p.contact_phone}</a></Button>}{p.contact_email&&<Button asChild size="sm" variant="outline"><a href={`mailto:${p.contact_email}`}><Mail className="h-3 w-3"/>Email</a></Button>}</div><a href={p.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-[11px] text-primary">Official source · checked {p.checked_at.slice(0,10)}</a></div></article>;}
  return <section className="space-y-5 border-t py-5">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><MapPin className="h-5 w-5 text-primary"/>Know your ward</h2>
    {recorded&&recorded.identifier!==ward.identifier&&<p className="text-xs text-muted-foreground">This case originally recorded ward {recorded.name}. Showing the latest directory.</p>}
    <WardSummary ward={ward} portraits={relevant}/>
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Building2 className="h-4 w-4 text-primary"/>Who handles this</h3>
      {route?<div className="rounded-xl border bg-card p-3"><p className="text-xs text-muted-foreground">Receiving department</p><p className="text-sm font-semibold">{route.receiving_office}</p><p className="mt-2 text-xs text-muted-foreground">Field team</p><p className="text-sm">{route.fixing_team} · {route.officer_role}</p>{route.verification_status==='verified'&&route.contact_phone&&<Button asChild variant="outline" size="sm" className="mt-2"><a href={`tel:${route.contact_phone}`}><Phone className="h-3 w-3"/>{route.contact_phone}</a></Button>}</div>:<p className="text-sm text-muted-foreground">The department will be confirmed when the issue is classified.</p>}
      {officers.length>0&&<div className="mt-2 grid gap-2">{officers.map(profile)}</div>}
      {city.length>0&&<div className="mt-2 grid gap-2 sm:grid-cols-2">{city.map(a=><a key={a.id} href={`tel:${a.phone}`} className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:bg-secondary"><Landmark className="h-5 w-5 shrink-0 text-primary"/><span className="min-w-0"><span className="block truncate text-sm font-medium">{a.name}</span><span className="text-xs text-primary">{a.phone}</span></span></a>)}</div>}
    </div>
    <p className="text-[11px] text-muted-foreground">Ward boundary: official GBA snapshot {ward.source_published_at??ward.verified_at} · <a href={ward.source_url} target="_blank" rel="noopener noreferrer" className="text-primary">source</a>. Authority names are indicative; CivicFix is not a government channel.</p>
  </section>;
}
