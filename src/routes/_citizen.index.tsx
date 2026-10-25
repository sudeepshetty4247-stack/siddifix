import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Camera, Map, MapPin, Search, ShieldCheck, FileText, MessageCircle, ChartNoAxesCombined } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { publicCases } from '@/lib/public-cases';
import { IssueCard } from '@/components/civic/IssueCard';
import communityCover from '@/assets/siddi-community-cover.png.asset.json';
import { NearbyCaseSummary } from '@/components/civic/NearbyCaseSummary';
import { CityOverview } from '@/components/civic/CityOverview';
import { useLocation } from '@/lib/location';
import { areaSettings } from '@/lib/service-area';
import { useI18n } from '@/lib/i18n';
import { AreaAuthoritySummary } from '@/components/civic/AreaAuthoritySummary';
import { useShowcase, ShowcaseBadge } from '@/lib/showcase';
export const Route = createFileRoute('/_citizen/')({
  head: () => ({ meta: [
    {title:'Siddhi — Report a problem. Track the progress.'},
    {name:'description',content:'Report a civic problem in a configured service area with a photo, track your case and discover local reports on Civic Map. No citizen login required.'},
    {property:'og:title',content:'Siddhi — Your city, your voice'},
    {property:'og:description',content:'Photo reporting, public case histories and location-aware civic information in one independent citizen platform.'},
    {property:'og:type',content:'website'},
    {name:'twitter:card',content:'summary'},
  ]}),
  component: CitizenHome,
});

function CitizenHome() {
  const { showcase } = useShowcase();
  const {activeArea,activeAreaId}=useLocation();
  const {tx}=useI18n();
  const recent = useQuery({ queryKey: ['home-recent-issues', showcase,activeAreaId], queryFn: async () => {
    return (await publicCases(undefined, showcase,activeAreaId)).slice(0, 3);
  }, refetchInterval: 30000 });
  return <div>
    <section className="relative isolate overflow-hidden bg-ink text-ink-foreground">
      <img src={communityCover.url} alt="A citizen photographing a damaged Bengaluru pavement near Vidhana Soudha" width={1365} height={768} className="absolute inset-0 -z-20 h-full w-full object-cover object-center" fetchPriority="high" />
      <div className="home-photo-shade absolute inset-0 -z-10" />
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 sm:py-16 lg:py-20">
        <p className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase"><MapPin className="h-4 w-4" />{activeArea?.name??'Siddhi'}{activeArea ? `, ${areaSettings(activeArea).state_name??''}`:''}</p>
        <h1 className="text-4xl font-bold sm:text-5xl lg:text-6xl">Siddhi</h1>
        <p className="mt-5 max-w-xl text-xl font-medium sm:text-2xl">Your City. Your Voice.<br />{tx('betterNeighbourhood')}</p>
        <p className="mt-4 max-w-md text-sm leading-relaxed opacity-90">{tx('homeDescription')}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-12 rounded-lg px-5"><Link to="/report"><Camera className="h-5 w-5" />{tx('reportCta')}<ArrowRight className="h-4 w-4" /></Link></Button>
          <Button asChild size="lg" variant="secondary" className="h-12 rounded-lg px-5"><Link to="/track"><Search className="h-4 w-4" />{tx('track')}</Link></Button>
        </div>
        <p className="mt-5 flex items-center gap-2 text-xs opacity-90"><ShieldCheck className="h-4 w-4" />{tx('independent')}</p>
      </div>
    </section>
    {activeAreaId==='anantapur'&&<AreaAuthoritySummary/>}
    <CityOverview />
    <NearbyCaseSummary />

    <section className="border-b bg-card">
      <div className="mx-auto grid max-w-7xl gap-0 px-5 sm:px-6 md:grid-cols-3">
        {[
          { to: '/report' as const, icon: Camera, label: 'Make it visible', title: 'Report a problem', text: 'Photo, confirmed location, and a case you can follow.' },
          { to: '/map' as const, icon: Map, label: 'Around your neighbourhood', title: 'Open Civic Map', text: 'Recorded local reports and verified boundaries.' },
          { to: '/track' as const, icon: FileText, label: 'Stay with your case', title: 'Follow the progress', text: 'Your report reference, recorded updates and resolution evidence.' },
        ].map(({ to, icon: Icon, label, title, text }) => <Link key={to} to={to} className="group flex gap-4 border-b py-7 transition-colors hover:bg-secondary md:border-b-0 md:px-5 md:first:pl-0 md:last:pr-0">
          <Icon className="mt-1 h-6 w-6 shrink-0 text-primary" />
          <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><h2 className="mt-1 flex items-center gap-3 text-lg font-semibold">{title}<ArrowRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-1" /></h2><p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{text}</p></div>
        </Link>)}
      </div>
    </section>

    <section className="border-b bg-primary-soft"><div className="mx-auto grid max-w-7xl gap-6 px-5 py-7 sm:px-6 md:grid-cols-2"><Link to="/transparency" className="flex items-start gap-4"><ChartNoAxesCombined className="mt-1 h-6 w-6 shrink-0 text-primary" /><div><h2 className="flex items-center gap-3 text-lg font-semibold">Public transparency report<ArrowRight className="h-4 w-4" /></h2><p className="mt-2 text-sm text-muted-foreground">City, ward and constituency progress. Real numbers, downloadable records.</p></div></Link><Link to="/assistant" className="flex items-start gap-4"><MessageCircle className="mt-1 h-6 w-6 shrink-0 text-primary" /><div><h2 className="flex items-center gap-3 text-lg font-semibold">Ask Siddhi<ArrowRight className="h-4 w-4" /></h2><p className="mt-2 text-sm text-muted-foreground">Your questions. Your language.</p></div></Link></div></section>

    <section className="mx-auto max-w-7xl px-5 py-10 sm:px-6 sm:py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase text-primary">{tx('community')}</p><h2 className="flex flex-wrap items-center gap-3 text-2xl font-semibold">{tx('latestReports')}<ShowcaseBadge /></h2></div><Button asChild variant="outline"><Link to="/explore">{tx('allReports')}<ArrowRight className="h-4 w-4" /></Link></Button></div>
      {recent.isPending ? <p role="status" className="py-8 text-sm text-muted-foreground">Loading recent reports…</p> : recent.isError ? <div role="alert" className="border-y py-6"><p className="text-sm">Recent reports couldn't be loaded.</p><Button className="mt-3" variant="outline" onClick={() => recent.refetch()}>Try again</Button></div> : recent.data.length ? <div className="grid gap-4 md:grid-cols-3">{recent.data.map(issue => <IssueCard key={issue.id} issue={issue} />)}</div> : <div className="flex flex-col items-start justify-between gap-5 border-y py-8 sm:flex-row sm:items-center"><div><h3 className="text-lg font-semibold">Every better street starts with one report.</h3><p className="mt-2 max-w-lg text-sm text-muted-foreground">{tx('noReports')}</p></div><Button asChild><Link to="/report"><Camera className="h-4 w-4" />Be the first to report</Link></Button></div>}
    </section>
  </div>;
}
