import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Repeat, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { categoryById, timeAgo } from "@/lib/civic";
import { Button } from "@/components/ui/button";
import { caseMetrics, DUPLICATE_RULES, findDuplicateSuggestions, findRecurringPatterns, RECURRENCE_RULES, type IntelCase } from "@/lib/case-intelligence";

export const Route = createFileRoute("/_authenticated/staff/insights")({
  head: () => ({ meta: [
    { title: "Duplicates & recurring issues — Siddhi" },
    { name: "description", content: "Explainable duplicate suggestions and recurring-problem locations for staff review." },
    { property: "og:title", content: "Duplicates & recurring issues — Siddhi" },
    { property: "og:description", content: "Explainable duplicate suggestions and recurring-problem locations for staff review." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: InsightsPage,
});

type Row = IntelCase & { photo_url: string | null; routing_snapshot: { ward?: { name?: string } | null } | null };

function InsightsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["case-intelligence"],
    refetchInterval: 60000,
    queryFn: async () => {
      const [issues, reviews] = await Promise.all([
        supabase.from("issues").select("id,ref_code,title,summary,category,severity,status,lat,lng,created_at,resolved_at,duplicate_of,photo_url,routing_snapshot").order("created_at", { ascending: false }).limit(5000),
        supabase.from("issue_duplicate_reviews").select("report_id,candidate_id").limit(5000),
      ]);
      if (issues.error) throw issues.error;
      if (reviews.error) throw reviews.error;
      const rows = (issues.data ?? []).map(r => ({ ...r, ward: (r.routing_snapshot as Row["routing_snapshot"])?.ward?.name ?? null })) as Row[];
      return { rows, decided: new Set((reviews.data ?? []).map(r => `${r.report_id}:${r.candidate_id}`)), capped: rows.length >= 5000 };
    },
  });
  const data = useMemo(() => q.data && ({
    metrics: caseMetrics(q.data.rows),
    suggestions: findDuplicateSuggestions(q.data.rows, q.data.decided),
    patterns: findRecurringPatterns(q.data.rows),
  }), [q.data]);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function decide(report: string, candidate: string, decision: "merge" | "related" | "reject") {
    const why = (reason[report] ?? "").trim();
    if (why.length < 5) { toast.error("Give a reason of at least 5 characters"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("review_issue_duplicate", { _report: report, _candidate: candidate, _decision: decision, _reason: why });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(decision === "merge" ? "Linked as duplicate — both tracking references still work" : decision === "related" ? "Recorded as related; kept as separate issues" : "Suggestion rejected");
    qc.invalidateQueries({ queryKey: ["case-intelligence"] });
  }

  const m = data?.metrics;
  return (
    <div className="mx-auto max-w-6xl space-y-10 p-4 sm:p-8">
      <header>
        <h1 className="text-3xl font-bold">Duplicates & recurring issues</h1>
        <p className="mt-1 max-w-3xl text-muted-foreground">Rule-based suggestions for staff to review. Nothing is merged automatically, and every decision is recorded. Scores are explained signals, not model confidence.</p>
      </header>

      {q.isLoading ? <p>Analysing cases…</p> : q.isError ? <Button variant="outline" onClick={() => q.refetch()}>Retry</Button> : m && <>
        <section aria-label="Counting summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[["Citizen reports", m.totalReports], ["Unique issues", m.uniqueIssues], ["Linked duplicate reports", m.linkedDuplicateReports], ["Active issues", m.activeIssues], ["Resolved issues", m.resolvedIssues], ["Reopened", m.reopenedIssues]].map(([l, v]) => (
            <div key={l} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="text-2xl font-bold">{v}</p></div>
          ))}
        </section>
        {q.data?.capped && <p className="text-sm text-warning">Showing the latest 5,000 reports; older history is not included in this analysis.</p>}

        <section>
          <h2 className="flex items-center gap-2 text-xl font-semibold"><Copy className="h-5 w-5" /> Possible duplicates <span className="text-sm font-normal text-muted-foreground">({data.suggestions.length})</span></h2>
          {!data.suggestions.length ? <p className="mt-3 text-sm text-muted-foreground">No likely duplicates right now.</p> : data.suggestions.map(s => (
            <article key={s.report.id} className="mt-4 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold"><Link to="/staff/issues/$id" params={{ id: s.report.id }} className="underline">{s.report.ref_code}</Link> may duplicate <Link to="/staff/issues/$id" params={{ id: s.candidate.id }} className="underline">{s.candidate.ref_code}</Link></h3>
                <span className="rounded-full bg-muted px-3 py-1 text-xs">Signal score {s.score.toFixed(2)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{s.reasons.join(" · ")}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[s.report, s.candidate].map((r, i) => { const row = r as Row; return (
                  <div key={r.id} className="rounded-lg border p-3">
                    <p className="text-xs font-medium text-muted-foreground">{i ? "Earlier issue" : "Newer report"} · {timeAgo(r.created_at)} · {r.status.replace(/_/g, " ")}</p>
                    {row.photo_url ? <img src={row.photo_url} alt={`Evidence for ${r.ref_code}`} className="my-2 aspect-video w-full rounded-md object-cover" loading="lazy" /> : <p className="my-2 text-sm">No photo</p>}
                    <p className="font-medium">{r.title}</p><p className="text-sm text-muted-foreground">{r.summary}</p>
                  </div>
                ); })}
              </div>
              <input aria-label="Decision reason" placeholder="Reason for your decision" value={reason[s.report.id] ?? ""} onChange={e => setReason(v => ({ ...v, [s.report.id]: e.target.value }))} maxLength={1000} className="mt-3 w-full rounded-lg border bg-background p-2 text-sm" />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" disabled={busy} onClick={() => decide(s.report.id, s.candidate.id, "merge")}>Same issue — link</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => decide(s.report.id, s.candidate.id, "related")}>Related, keep separate</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => decide(s.report.id, s.candidate.id, "reject")}>Not a duplicate</Button>
              </div>
            </article>
          ))}
        </section>

        <section>
          <h2 className="flex items-center gap-2 text-xl font-semibold"><Repeat className="h-5 w-5" /> Recurring problem locations <span className="text-sm font-normal text-muted-foreground">({data.patterns.length})</span></h2>
          <p className="mt-1 text-sm text-muted-foreground">Places where the same kind of problem came back after a repair. Decision support only, not a judgement of any officer.</p>
          {!data.patterns.length ? <p className="mt-3 text-sm text-muted-foreground">No recurring locations detected yet.</p> : data.patterns.map(p => (
            <article key={p.key} className="mt-4 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">{categoryById(p.category)?.label ?? p.category} · {p.ward ?? "Ward not resolved"}</h3>
                <span className="rounded-full bg-muted px-3 py-1 text-xs" title={`incidents ${p.priorityParts.incidents} + returns ${p.priorityParts.recurrences} + severity ${p.priorityParts.severity} + open ${p.priorityParts.open} + quick return ${p.priorityParts.recency}`}>Priority {p.priority}</span>
              </div>
              <p className="mt-1 text-sm">{p.reason}</p>
              <p className="text-xs text-muted-foreground">{p.incidents.length} incidents from {p.reportCount} citizen reports · first {new Date(p.firstAt).toLocaleDateString()} · latest {new Date(p.lastAt).toLocaleDateString()}{p.lastResolvedAt ? ` · last repaired ${new Date(p.lastResolvedAt).toLocaleDateString()}` : ""} · {p.openNow ? "open now" : "currently resolved"}</p>
              {p.uncertain && <p className="mt-1 text-xs text-warning">Some earlier incidents have no recorded repair, so the history is incomplete.</p>}
              <p className="mt-2 text-sm font-medium">Suggested: {p.suggestion}</p>
              <div className="mt-2 flex flex-wrap gap-2">{p.incidents.map(i => <Link key={i.id} to="/staff/issues/$id" params={{ id: i.id }} className="rounded-md border px-2 py-1 text-xs underline">{i.ref_code} · {i.status.replace(/_/g, " ")}</Link>)}</div>
            </article>
          ))}
        </section>

        <section className="rounded-xl border bg-muted/40 p-4 text-sm">
          <h2 className="flex items-center gap-2 font-semibold"><Info className="h-4 w-4" /> How these are calculated</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Duplicate suggestion: same category, within {DUPLICATE_RULES.maxDistanceM} m and {DUPLICATE_RULES.maxGapDays} days, earlier issue not already repaired. Score = 0.5 × closeness + 0.3 × time closeness + 0.2 × description word overlap; shown at {DUPLICATE_RULES.minScore} or above.</li>
            <li>Recurring location: at least {RECURRENCE_RULES.minIncidents} distinct incidents of one category within {RECURRENCE_RULES.radiusM} m over {RECURRENCE_RULES.windowDays} days, where an incident started {RECURRENCE_RULES.minDaysAfterResolution}+ days after an earlier repair or was reopened. Linked duplicate reports never count as incidents.</li>
            <li>Priority = (incidents − 1) + 2 × returns + severity (1–4) + 3 if open + 2 if it returned within 30 days of a repair.</li>
            <li>Unique issues exclude linked duplicate reports and rejected cases; resolved counts each issue once.</li>
          </ul>
        </section>
      </>}
    </div>
  );
}
