import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Inbox, Timer, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, OPEN_STATUSES, isOverdue, timeAgo, categoryById } from "@/lib/civic";
import { StatusBadge, SeverityTag } from "@/components/civic/StatusBadge";
import { CaseMetrics } from '@/components/civic/CaseMetrics';

export const Route = createFileRoute("/_authenticated/staff/")({
  head: () => ({ meta: [{ title: "Staff overview — CivicFix" }, { name: "description", content: "Review actual civic report counts and triage priorities." }, { property: "og:title", content: "Staff overview — CivicFix" }, { property: "og:description", content: "Review actual civic report counts and triage priorities." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Overview,
});

function Overview() {
  const q = useQuery({
    queryKey: ["staff-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("issues").select("id, ref_code, title, category, severity, status, sla_due_at, created_at, resolved_at").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data;
    },
  });
  const all = q.data ?? [];
  const open = all.filter((i) => OPEN_STATUSES.includes(i.status as never));
  const overdue = open.filter(isOverdue);
  const resolved = all.filter((i) => i.resolved_at);
  const avgHrs = resolved.length ? Math.round(resolved.reduce((s, i) => s + (i.resolved_at ? new Date(i.resolved_at).getTime() - new Date(i.created_at).getTime() : 0), 0) / resolved.length / 3600_000) : null;
  const unclassified = open.filter((i) => i.status === "needs_classification" || i.status === "submitted");
  const byCat = CATEGORIES.map((c) => ({ ...c, n: open.filter((i) => i.category === c.id).length })).filter((c) => c.n > 0).sort((a, b) => b.n - a.n);
  const maxCat = Math.max(1, ...byCat.map((c) => c.n));

  const stats = [
    { label: "Open issues", value: open.length, icon: Inbox, tone: "text-primary bg-primary-soft" },
    { label: "Need triage", value: unclassified.length, icon: AlertTriangle, tone: "text-warning-foreground bg-warning-soft" },
    { label: "Overdue", value: overdue.length, icon: Timer, tone: "text-destructive bg-destructive-soft" },
    { label: "Avg. resolution", value: avgHrs === null ? "—" : avgHrs < 48 ? `${avgHrs}h` : `${Math.round(avgHrs / 24)}d`, icon: CheckCircle2, tone: "text-success bg-success-soft" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-8">
      <div>
        <h1 className="text-3xl font-bold">Overview</h1>
        <p className="text-muted-foreground">What needs attention today.</p>
      </div>
      <CaseMetrics />
      <p className="text-xs text-muted-foreground">Recent triage sample below is limited to the latest 1,000 reports; analytics above cover all persisted cases.</p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border bg-card p-5 shadow-soft">
            <span className={`inline-flex rounded-lg p-2 ${s.tone}`}><s.icon className="h-5 w-5" /></span>
            <p className="mt-4 font-display text-3xl font-bold">{q.isLoading ? "—" : s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border bg-card shadow-soft">
          <div className="flex items-center justify-between border-b p-5">
            <h2 className="font-semibold">Triage inbox</h2>
            <Link to="/staff/queue" className="flex items-center gap-1 text-sm font-semibold text-primary">Open queue <ArrowRight className="h-4 w-4" /></Link>
          </div>
          {unclassified.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Inbox zero. New citizen reports will appear here.</p>
          ) : (
            <ul className="divide-y">
              {unclassified.slice(0, 8).map((i) => (
                <li key={i.id}>
                  <Link to="/staff/issues/$id" params={{ id: i.id }} className="flex items-center gap-4 p-4 hover:bg-secondary">
                    <span className="text-xl">{categoryById(i.category).emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{i.title}</p>
                      <p className="text-xs text-muted-foreground"><span className="font-mono">{i.ref_code}</span> · {timeAgo(i.created_at)}</p>
                    </div>
                    <SeverityTag severity={i.severity} />
                    <StatusBadge status={i.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-5 shadow-soft">
            <h2 className="font-semibold">Open by category</h2>
            <div className="mt-4 space-y-3">
              {byCat.length === 0 && <p className="text-sm text-muted-foreground">No open issues.</p>}
              {byCat.map((c) => (
                <div key={c.id}>
                  <div className="flex justify-between text-sm"><span>{c.emoji} {c.label}</span><span className="font-semibold">{c.n}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-secondary"><div className="h-2 rounded-full bg-primary" style={{ width: `${(c.n / maxCat) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
          {overdue.length > 0 && (
            <div className="rounded-2xl border border-warning/40 bg-warning-soft p-5">
              <h2 className="flex items-center gap-2 font-semibold text-warning-foreground"><Timer className="h-4 w-4" /> Overdue</h2>
              <ul className="mt-3 space-y-2">
                {overdue.slice(0, 5).map((i) => (
                  <li key={i.id}><Link to="/staff/issues/$id" params={{ id: i.id }} className="block truncate text-sm font-medium hover:underline">{i.ref_code} · {i.title}</Link></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
