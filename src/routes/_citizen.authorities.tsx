import { createFileRoute } from '@tanstack/react-router';
import { Building2, MapPin, ShieldCheck } from 'lucide-react';
import { AuthorityDirectory } from '@/components/civic/AuthorityDirectory';
import { useLocation } from '@/lib/location';
import { CivicInfo } from '@/components/civic/CivicInfo';

export const Route = createFileRoute('/_citizen/authorities')({
  head: () => ({ meta: [
    { title: 'Bengaluru authorities & public service contacts — CivicFix' },
    { name: 'description', content: 'Official Bengaluru civic service contacts, complaint channels, responsibility boundaries and source-backed local information.' },
    { property: 'og:title', content: 'Bengaluru authority directory — CivicFix' },
    { property: 'og:description', content: 'Find public service contacts and official complaint channels for Bengaluru.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: Authorities,
});

function Authorities() {
  const { location } = useLocation();
  return <>
    <header className="border-b bg-card"><div className="mx-auto max-w-7xl px-4 py-8 sm:px-6"><p className="flex items-center gap-2 text-xs font-semibold uppercase text-primary"><Building2 className="h-4 w-4" />Public accountability</p><h1 className="mt-3 text-3xl font-bold sm:text-4xl">Bengaluru authorities</h1><p className="mt-3 max-w-2xl text-muted-foreground">Find the right service, check the official source, and contact the responsible organisation.</p></div></header>
    <AuthorityDirectory />
    <section className="border-y bg-card"><div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-2"><div><h2 className="flex items-center gap-2 text-xl font-semibold"><MapPin className="h-5 w-5 text-primary" />Know your ward</h2>{location ? <CivicInfo lat={location.lat} lng={location.lng} /> : <p className="mt-4 text-sm text-muted-foreground">Choose a location to check available ward information.</p>}</div><div><h2 className="text-xl font-semibold">Municipal responsibility chain</h2><ol className="mt-5 space-y-0">{['Greater Bengaluru Authority — city-wide coordination', 'City corporation — municipal administration', 'Zone and ward offices — local service handling', 'Department / asset owner — inspection and action'].map((s,i) => <li key={s} className="flex gap-4 border-l-2 border-primary/30 py-3 pl-4"><span className="font-mono text-sm text-primary">0{i+1}</span><p className="text-sm">{s}</p></li>)}</ol><p className="mt-5 flex gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0" />An organisation's service remit is not proof of ownership. Ward-specific officers and elected representatives are shown only when their current official source is available.</p></div></div></section>
  </>;
}