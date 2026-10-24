import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Camera, MapPin, Sparkles, Route as RouteIcon, BellRing, RotateCcw, CheckCircle2, ShieldCheck } from "lucide-react";
import heroImg from "@/assets/hero-street.jpg";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { CATEGORIES, OPEN_STATUSES } from "@/lib/civic";
import { IssueCard, ISSUE_COLUMNS, type IssueRow } from "@/components/civic/IssueCard";

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
      return { total: total.count ?? 0, open: open.count ?? 0, resolved: resolved.count ?? 0 };
    },
  });
}

function Home() {
  const { t } = useI18n();
  const stats = useStats();
  const recent = useQuery({
    queryKey: ["recent-issues"],
    queryFn: async () => {
      const { data, error } = await supabase.from("issues").select(ISSUE_COLUMNS).order("created_at", { ascending: false }).limit(6);
      if (error) throw error;
      return data as IssueRow[];
    },
  });

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-civic-grid">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div className="animate-rise space-y-7">
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
              <span className="h-2 w-2 rounded-full bg-success" /> Live in Bengaluru · {t("noLogin")}
            </span>
            <h1 className="text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">
              {t("heroTitle").split(". ")[0]}.<br />
              <span className="text-primary">{t("heroTitle").split(". ").slice(1).join(". ")}</span>
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">{t("heroSub")}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/report" className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground shadow-lift transition hover:-translate-y-0.5 hover:bg-primary/90">
                <Camera className="h-5 w-5" /> {t("reportCta")}
              </Link>
              <Link to="/map" className="inline-flex h-12 items-center gap-2 rounded-xl border bg-card px-5 text-base font-semibold transition hover:bg-secondary">
                <MapPin className="h-5 w-5" /> {t("map")}
              </Link>
            </div>
            <dl className="grid max-w-md grid-cols-3 gap-4 pt-2">
              {[
                ["Reports", stats.data?.total],
                ["Open", stats.data?.open],
                ["Resolved", stats.data?.resolved],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-xl border bg-card p-3 shadow-soft">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="font-display text-2xl font-bold">{stats.isLoading ? "—" : (v as number)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative animate-rise [animation-delay:120ms]">
            <img src={heroImg} alt="A Bengaluru street with a reported pothole pinned on the footpath" width={1280} height={1024} className="aspect-[5/4] w-full rounded-3xl object-cover shadow-lift" />
            <div className="absolute -bottom-6 left-4 right-4 rounded-2xl border bg-card/95 p-4 shadow-lift backdrop-blur sm:left-auto sm:right-6 sm:w-80">
              <div className="flex items-start gap-3">
                <span className="rounded-lg bg-primary-soft p-2 text-primary"><Sparkles className="h-5 w-5" /></span>
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">Deep pothole on footpath</p>
                  <p className="text-muted-foreground">Roads & Footpaths · High severity</p>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">Assigned</span>
                    <span className="text-muted-foreground">→ BBMP Road Infrastructure</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">The Civic Continuity Engine</p>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Nothing gets lost between departments.</h2>
          <p className="mt-3 text-muted-foreground">Every report keeps its full history — who owns it, what changed, and what happens next — even when it's reassigned, delayed or disputed.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Camera, title: "Snap & pin", body: "Take a photo and drop a pin. No account, no forms." },
            { icon: Sparkles, title: "AI understands it", body: "Category, severity and a clear summary — editable by you." },
            { icon: RouteIcon, title: "Routed & owned", body: "Matched to the likely authority and assigned to a team." },
            { icon: RotateCcw, title: "Challenge bad closures", body: "Not actually fixed? Reopen it with your private link." },
          ].map((s, i) => (
            <div key={s.title} className="relative rounded-2xl border bg-card p-6 shadow-soft">
              <span className="absolute right-5 top-5 font-mono text-xs text-muted-foreground">0{i + 1}</span>
              <s.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent */}
      <section className="border-y bg-card/60">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">Latest reports</h2>
              <p className="mt-1 text-muted-foreground">Real submissions from citizens, updated live.</p>
            </div>
            <Link to="/explore" className="hidden items-center gap-1 text-sm font-semibold text-primary sm:flex">View all <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-8">
            {recent.isLoading ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />)}</div>
            ) : recent.data && recent.data.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{recent.data.map((i) => <IssueCard key={i.id} issue={i} />)}</div>
            ) : (
              <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
                <CheckCircle2 className="h-10 w-10 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">No reports yet</h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">Be the first to put a problem on the map. It takes less than a minute.</p>
                <Link to="/report" className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"><Camera className="h-4 w-4" /> Report a problem</Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <h2 className="text-2xl font-bold sm:text-3xl">What you can report</h2>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <Link key={c.id} to="/report" className="flex items-center gap-3 rounded-xl border bg-card p-4 transition hover:border-primary/40 hover:bg-primary-soft">
              <span className="text-2xl">{c.emoji}</span>
              <span className="text-sm font-medium">{c.label}</span>
            </Link>
          ))}
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-2">
          <div className="flex gap-4 rounded-2xl bg-ink p-6 text-ink-foreground">
            <BellRing className="h-6 w-6 shrink-0 text-sidebar-primary" />
            <div>
              <h3 className="font-semibold">Track without an account</h3>
              <p className="mt-1 text-sm opacity-80">Your reports are saved on this device with a private recovery link you can keep or share.</p>
            </div>
          </div>
          <div className="flex gap-4 rounded-2xl border bg-card p-6">
            <ShieldCheck className="h-6 w-6 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold">Privacy first</h3>
              <p className="mt-1 text-sm text-muted-foreground">Photos are resized and stripped of hidden location data before upload. We never ask for your name or phone.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
