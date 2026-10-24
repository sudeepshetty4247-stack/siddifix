import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Camera, MapPin, Sparkles, Route as RouteIcon, BellRing, RotateCcw, CheckCircle2, ShieldCheck } from "lucide-react";
import heroImg from "@/assets/hero-street.jpg";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { CATEGORIES, OPEN_STATUSES } from "@/lib/civic";
import { Button } from "@/components/ui/button";
import { useLocation } from "@/lib/location";
import { getDirectory } from "@/lib/directory.functions";
import { resolveCivicRouting } from "@/lib/directory";
import { IssueCard, ISSUE_COLUMNS, type IssueRow } from "@/components/civic/IssueCard";
import { AuthorityDirectory } from "@/components/civic/AuthorityDirectory";

export const Route = createFileRoute("/_citizen/")({
  head: () => ({
    meta: [
      { title: "CivicFix — Report civic issues in Bengaluru and track every action" },
      { name: "description", content: "Photograph a pothole, broken streetlight or blocked drain. CivicFix classifies it with AI, routes it and keeps a public record until it's fixed." },
      { property: "og:title", content: "CivicFix — Report once. Track every action." },
      { property: "og:description", content: "AI-powered public infrastructure reporting and resolution tracking for Bengaluru." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function useStats() {
  return useQuery({
    queryKey: ["home-stats"],
    queryFn: async () => {
      const [total, open, resolved] = await Promise.all([
        supabase.from("issues").select("id", { count: "exact", head: true }),
        supabase.from("issues").select("id", { count: "exact", head: true }).in("status", OPEN_STATUSES),
        supabase.from("issues").select("id", { count: "exact", head: true }).in("status", ["resolved", "closed"]),
      ]);
      for (const result of [total, open, resolved]) if (result.error) throw result.error;
      return { total: total.count ?? 0, open: open.count ?? 0, resolved: resolved.count ?? 0 };
    },
  });
}

function Home() {
  const { t } = useI18n();
  const stats = useStats();
  const { location } = useLocation();
  const directory = useQuery({ queryKey: ['civic-directory'], queryFn: () => getDirectory(), staleTime: 300000 });
  const coverageNotice = location && directory.data ? resolveCivicRouting(directory.data, location.lat, location.lng).coverage?.notice ?? 'Community reporting is available here. Verified local authority data is not yet configured.' : 'Checking local coverage…';
  const recent = useQuery({
    queryKey: ["recent-issues", location?.lat, location?.lng],
    refetchInterval: 30000,
    queryFn: async () => {
      let request = supabase.from("issues").select(ISSUE_COLUMNS).order("updated_at", { ascending: false }).limit(6);
      if (location) request = request.gte('lat', location.lat - 0.05).lte('lat', location.lat + 0.05).gte('lng', location.lng - 0.05).lte('lng', location.lng + 0.05);
      const { data, error } = await request;
      if (error) throw error;
      return data as IssueRow[];
    },
  });

  return (
    <>
      <section className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary"><span className="h-2 w-2 rounded-full bg-primary" /> Your neighbourhood. Your voice.</p>
            <span className="text-xs text-muted-foreground">No citizen account required</span>
          </div>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl">CivicFix</h1>
          <p className="mt-2 max-w-xl text-lg text-muted-foreground">Show us the problem. Keep every action on record.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/report"><Camera className="h-5 w-5" />Report a Civic Issue<ArrowRight className="h-4 w-4" /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/map"><MapPin className="h-5 w-5" />Explore Nearby Issues</Link></Button>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-8 gap-y-2 border-t pt-5 text-sm">
            {[["Reports", stats.data?.total], ["Open", stats.data?.open], ["Resolved", stats.data?.resolved]].map(([label, value]) => <div key={String(label)} className="flex items-baseline gap-2"><strong className="font-display text-2xl">{stats.isLoading || stats.isError ? "—" : value}</strong><span className="text-muted-foreground">{label}</span></div>)}
            <Link to="/track" className="ml-auto inline-flex items-center gap-2 font-semibold text-primary"><BellRing className="h-4 w-4" />My Tracking</Link>
          </div>
          {location && <p className="mt-4 flex items-start gap-2 border-l-2 border-warning pl-3 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-warning" />{coverageNotice}</p>}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        <div className="grid gap-6 md:grid-cols-[1fr_260px]">
          <div><h2 className="text-xl font-semibold">What needs attention?</h2><div className="mt-4 flex flex-wrap gap-2">{CATEGORIES.slice(0, 6).map(c => <Button asChild key={c.id} variant="outline" className="h-auto whitespace-normal py-3"><Link to="/report"><span className="text-lg">{c.emoji}</span>{c.label}</Link></Button>)}</div></div>
          <div className="relative min-h-36 overflow-hidden rounded-lg"><img src={heroImg} alt="Damaged paving on a Bengaluru street" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-x-0 bottom-0 bg-ink/90 px-3 py-2 text-xs text-ink-foreground">A photo. A confirmed location. A public record.</div></div>
        </div>
      </section>
      <AuthorityDirectory compact />
      {/* Recent */}
      <section className="border-y bg-card/60">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">Recently updated reports</h2>
              <p className="mt-1 text-muted-foreground">Recorded in CivicFix · refreshes every 30 seconds.</p>
            </div>
            <Link to="/explore" className="hidden items-center gap-1 text-sm font-semibold text-primary sm:flex">View all <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-8">
            {recent.isLoading ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />)}</div>
            ) : recent.isError ? <div role="alert" className="py-6 text-sm"><p>Reports could not be loaded. Please try again.</p><Button variant="outline" className="mt-3" onClick={() => recent.refetch()}>Try again</Button></div> : recent.data && recent.data.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{recent.data.map((i) => <IssueCard key={i.id} issue={i} />)}</div>
            ) : (
              <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
                <CheckCircle2 className="h-10 w-10 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">No reports yet</h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">No CivicFix submissions in this area yet. This is not a count of government complaints or all city issues.</p>
                <Link to="/report" className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"><Camera className="h-4 w-4" /> Report a problem</Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-7xl flex-wrap gap-6 px-4 py-8 text-sm text-muted-foreground sm:px-6">
        <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />Independent platform · not a government service</p>
        <p className="flex items-center gap-2"><RotateCcw className="h-4 w-4 text-primary" />Original reporters can challenge a recorded closure</p>
      </section>
    </>
  );
}
