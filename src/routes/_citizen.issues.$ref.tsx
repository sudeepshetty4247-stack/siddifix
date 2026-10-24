import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Building2, CalendarClock, Copy, Download, Eye, EyeOff, MapPin, ShieldAlert, ThumbsDown, ThumbsUp, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { categoryById, isOverdue, SEVERITY_META, type Severity } from "@/lib/civic";
import { StatusBadge, SeverityTag } from "@/components/civic/StatusBadge";
import { Timeline, type EventRow } from "@/components/civic/Timeline";
import { LazyMap } from "@/components/civic/LazyMap";
import { citizenAction, verifyToken } from "@/lib/issues.functions";
import { getTracked, isTracked, removeTracked, saveTracked } from "@/lib/tracking";
import { CivicInfo } from "@/components/civic/CivicInfo";
import { IssueEvidence } from '@/components/civic/IssueEvidence';
import { JourneyBar, StaffResponse } from '@/components/civic/CaseProgress';
import { Button } from '@/components/ui/button';
import { publicCases, publicEvents } from '@/lib/public-cases';
import { getReportPhoto } from '@/lib/report-media.functions';
import { caseReport } from '@/lib/case-report';
import { downloadText } from '@/lib/transparency';

export const Route = createFileRoute("/_citizen/issues/$ref")({
  head: ({ params }) => ({
    meta: [
      { title: `Issue ${params.ref} — Siddi` },
      { name: "description", content: `Public status, location and full action history for civic issue ${params.ref}.` },
      { property: "og:title", content: `Civic issue ${params.ref} — Siddi` },
      { property: "og:description", content: "Follow this infrastructure issue from report to resolution." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IssuePage,
});

function IssuePage() {
  const { ref } = Route.useParams();
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [tokenValid, setTokenValid] = useState(false);
  const [following, setFollowing] = useState(false);
  const verify = useServerFn(verifyToken);
  const act = useServerFn(citizenAction);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  const issue = useQuery({
    queryKey: ["issue", ref],
    refetchInterval: 15000, refetchOnReconnect:"always",
    queryFn: async () => {
      return (await publicCases(ref))[0] ?? null;
    },
  });
  const events = useQuery({
    queryKey: ["issue-events", issue.data?.id],
    enabled: !!issue.data?.id,
    refetchInterval: 15000, refetchOnReconnect:"always",
    queryFn: async () => {
      if (!issue.data?.id) return [];
      return await publicEvents(issue.data.id);
    },
  });
  const canonical = useQuery({ queryKey: ['canonical-issue', issue.data?.duplicate_of], enabled: !!issue.data?.duplicate_of, queryFn: async () => {
    if (!issue.data?.duplicate_of) return null;
    return (await publicCases()).find(row=>row.id===issue.data?.duplicate_of) ?? null;
  }});
  const photo=useQuery({queryKey:['report-annotated-photo',issue.data?.id],enabled:!!issue.data?.id,queryFn:()=>{if(!issue.data?.id)return null;return getReportPhoto({data:{issueId:issue.data.id}});}});

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1)).get("t");
    const t = hash || getTracked().find((x) => x.ref === ref)?.token || null;
    setFollowing(isTracked(ref));
    if (t) {
      setToken(t);
      verify({ data: { ref, token: t } }).then((r) => setTokenValid(r.valid)).catch(()=>setTokenValid(false));
    }
  }, [ref, verify]);

  useEffect(() => {
    if (!issue.data?.id) return;
    const ch = supabase
      .channel(`issue-${issue.data.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "issue_events", filter: `issue_id=eq.${issue.data.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["issue", ref] });
        qc.invalidateQueries({ queryKey: ["issue-events"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [issue.data?.id, ref, qc]);

  if (issue.isLoading) return <div className="mx-auto max-w-6xl px-4 py-10"><div className="h-96 animate-pulse rounded-3xl bg-muted" /></div>;
  if (issue.isError && !issue.data) return <section className="mx-auto max-w-md space-y-4 px-4 py-24" role="alert"><h1 className="text-2xl font-bold">Case temporarily unavailable</h1><p>Your report was not changed. Please try again.</p><Button onClick={()=>issue.refetch()}>Retry</Button></section>;
  if (!issue.data)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">We couldn't find {ref}</h1>
        <p className="mt-2 text-muted-foreground">Check the reference code and try again.</p>
        <Link to="/track" className="mt-6 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Track another report</Link>
      </div>
    );

  const i = issue.data;
  const cat = categoryById(i.category);
  const overdue = isOverdue(i);
  const ageDays = Math.max(0, Math.floor((Date.now() - new Date(i.created_at).getTime()) / 86400000));
  const unresolved = !["resolved", "closed"].includes(i.status);
  const severityLabel = SEVERITY_META[i.severity as Severity].label.toUpperCase();
  const statusLabel = unresolved ? (overdue ? "OVERDUE" : "UNRESOLVED") : "RESOLVED";

  async function doAction(action: "reopen" | "confirm") {
    if (!token) return;
    setBusy(true);
    try {
      await act({ data: { ref, token, action, note: feedback } });
      toast.success(action === "reopen" ? "Issue reopened for staff review." : "Thanks for confirming the fix!");
      qc.invalidateQueries({ queryKey: ["issue", ref] });
      qc.invalidateQueries({ queryKey: ["issue-events", i.id] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function toggleFollow() {
    if (following) removeTracked(ref);
    else saveTracked({ ref, title: i.title, savedAt: new Date().toISOString(), token: token ?? undefined });
    setFollowing(!following);
    toast.success(following ? "Removed from My Tracking" : "Added to My Tracking");
  }

  const ward = (i.routing_snapshot as { ward?: { name?: string; ward_number?: number; zone?: string } } | null)?.ward ?? null;
  const area = i.landmark?.split(',').map(s => s.trim()).filter(Boolean).slice(-2, -1)[0] ?? null;
  const updatedAgo = (() => { const m = Math.max(1, Math.round((Date.now() - new Date(i.updated_at).getTime()) / 60000)); return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} hours ago` : `${Math.round(m / 1440)} days ago`; })();
  const statusTone = !unresolved ? 'bg-success/10 text-success ring-success/20' : overdue ? 'bg-destructive/10 text-destructive ring-destructive/20' : 'bg-primary-soft text-primary ring-primary/20';
  const statusText = i.status.replace(/_/g, ' ');
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {issue.isError&&<p role="alert" className="mb-4 text-sm text-warning-foreground">Updates could not be refreshed. Last successful check: {new Date(issue.dataUpdatedAt).toLocaleString("en-IN")}<Button variant="outline" size="sm" onClick={()=>issue.refetch()}>Retry</Button></p>}
      <div className="mb-4 flex items-center justify-between">
        <Link to="/explore" aria-label="All issues" className="inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All issues</Link>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={toggleFollow}>{following ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}<span className="hidden sm:inline">{following ? 'Unfollow' : 'Follow'}</span></Button>
          <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/issues/${ref}`); toast.success("Public link copied"); }}><Copy className="h-4 w-4" /><span className="hidden sm:inline">Share</span></Button>
          <Button size="sm" variant="ghost" disabled={!events.data || events.isError} onClick={() => downloadText(caseReport(i, events.data ?? []), `Siddi-${i.ref_code}.md`, 'text/markdown;charset=utf-8')}><Download className="h-4 w-4" /><span className="hidden sm:inline">Report</span></Button>
          <Button size="sm" variant="ghost" onClick={() => window.print()} className="hidden sm:inline-flex">PDF</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 space-y-5">
          <article className="overflow-hidden rounded-3xl border bg-card shadow-soft">
            <div className="space-y-3 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive">Civic issue · {SEVERITY_META[i.severity as Severity].label}</span>
                <div className="text-right">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1 ${statusTone}`}><span className="h-2 w-2 rounded-full bg-current" />{overdue && unresolved ? 'Overdue' : statusText}</span>
                  <p className="mt-1 text-[11px] text-muted-foreground">Updated {updatedAgo}</p>
                </div>
              </div>
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{i.title}</h1>
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{i.landmark || `${i.lat.toFixed(5)}, ${i.lng.toFixed(5)}`}</p>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-md bg-success/10 px-2 py-0.5 text-xs font-medium text-success">{cat.emoji} {cat.label}</span>
                {ward?.name && <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">Ward {ward.ward_number}</span>}
                {(area || ward?.name) && <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">{ward?.name ?? area}</span>}
                {i.support_count > 0 && <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">{i.support_count + 1} reports</span>}
              </div>
            </div>
            {i.photo_url && <img src={i.photo_url} alt={i.title} className="aspect-[16/10] max-h-[520px] w-full object-cover" />}
            <div className="space-y-4 p-5 sm:p-6">
              {(i.summary || i.description) && <div>
                {i.summary && <p className="text-sm leading-relaxed">{i.summary}</p>}
                {i.description && i.description !== i.summary && <p className="mt-2 border-l-2 pl-3 text-sm italic text-muted-foreground">"{i.description}"</p>}
              </div>}
              <dl className="grid grid-cols-3 divide-x rounded-2xl border bg-background text-center">
                <div className="p-3"><dt className="sr-only">Report ID</dt><dd className="truncate font-mono text-xs font-semibold">{i.ref_code}</dd><p className="mt-0.5 text-[11px] text-muted-foreground">Report ID</p></div>
                <div className="p-3"><dt className="sr-only">Reported</dt><dd className="text-xs font-semibold">{new Date(i.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</dd><p className="mt-0.5 text-[11px] text-muted-foreground">{new Date(i.created_at).toLocaleTimeString('en-IN', { timeStyle: 'short' })} · {ageDays === 0 ? 'today' : `${ageDays}d ago`}</p></div>
                <div className="p-3"><dt className="sr-only">Coordinates</dt><dd className="truncate text-xs font-semibold tabular-nums">{i.lat.toFixed(4)}, {i.lng.toFixed(4)}</dd><p className="mt-0.5 text-[11px] text-muted-foreground">Coordinates</p></div>
              </dl>
              <div className="divide-y rounded-2xl border">
                <div className="flex items-center gap-3 p-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-success/10 text-success"><MapPin className="h-4 w-4" /></span><div className="min-w-0"><p className="text-[11px] text-muted-foreground">Ward details</p><p className="truncate text-sm font-semibold">{ward?.name ? `Ward ${ward.ward_number} – ${ward.name}` : 'Ward under staff review'}</p>{ward?.zone && <p className="text-[11px] text-muted-foreground">{ward.zone} zone</p>}</div></div>
                <div className="flex items-center gap-3 p-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary"><Users className="h-4 w-4" /></span><div className="min-w-0"><p className="text-[11px] text-muted-foreground">Assigned team</p><p className="truncate text-sm font-semibold">{i.department ?? 'Ownership review pending'}</p><p className="text-[11px] text-muted-foreground">Internal Siddi record — not an official referral</p></div></div>
              </div>
            </div>
          </article>
          <div className="rounded-3xl border bg-card p-5 sm:p-6"><h2 className="mb-4 text-base font-semibold">Progress</h2><JourneyBar status={i.status} /></div>
          {i.duplicate_of && <section className="space-y-3 rounded-2xl border bg-primary-soft p-4"><h2 className="font-semibold">This original report is linked to an underlying issue</h2><p className="text-sm">Your reference, photo and history are preserved. Current work and resolution are tracked on the canonical issue.</p>{canonical.data?<Button asChild><Link to="/issues/$ref" params={{ref:canonical.data.ref_code}}>Track {canonical.data.ref_code} · {canonical.data.title}</Link></Button>:<p className="text-sm">{canonical.isError?'The linked issue could not be loaded.':'Loading linked issue…'}</p>}</section>}
          {i.duplicate_candidate_id && !i.duplicate_of && <p className="border-l-2 border-warning pl-3 text-sm text-muted-foreground">A possible matching report is awaiting staff review. This report has not been merged.</p>}
          {!i.duplicate_of && <StaffResponse c={i} />}
          {photo.data?.url&&<details className="rounded-2xl border bg-card p-4"><summary className="cursor-pointer text-sm font-semibold">Annotated report photo</summary><img src={photo.data.url} alt="Separate annotated report evidence with report location and available capture metadata" className="mt-4 w-full rounded-lg" loading="lazy"/><p className="mt-2 text-xs text-muted-foreground">A separate copy. The untouched original stays private; report location is not proof of photo capture location.</p></details>}
          {i.safety_warning && <div className="flex gap-3 rounded-2xl bg-destructive-soft p-4 text-sm text-destructive"><ShieldAlert className="h-5 w-5 shrink-0" />{i.safety_warning}</div>}
          <div className="rounded-2xl border bg-card p-6">
            <h2 className="mb-5 text-lg font-semibold">Action history</h2>
            {events.isError?<div role="alert"><p>History could not be loaded.</p><Button variant="outline" onClick={()=>events.refetch()}>Retry history</Button></div>:<Timeline events={events.data ?? []} />}
          </div>
          <IssueEvidence issueId={i.id} />
        </div>
        <aside className="min-w-0 space-y-4">
          {tokenValid && i.status === "resolved" && (
            <div className="rounded-2xl border-2 border-primary bg-primary-soft p-5">
              <p className="font-semibold">Has this problem been fixed?</p>
              <p className="mt-1 text-sm text-muted-foreground">As the original reporter, you can confirm or dispute this closure.</p>
              <label className="mt-3 block text-sm">Feedback (optional)<textarea aria-label="Reporter feedback" value={feedback} maxLength={500} onChange={e=>setFeedback(e.target.value)} className="mt-1 w-full rounded-lg border bg-card p-2"/></label>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button disabled={busy} onClick={() => doAction("confirm")} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-success text-sm font-semibold text-primary-foreground disabled:opacity-50"><ThumbsUp className="h-4 w-4" /> Yes, fixed</button>
                <button disabled={busy} onClick={() => doAction("reopen")} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-destructive text-sm font-semibold text-destructive-foreground disabled:opacity-50"><ThumbsDown className="h-4 w-4" /> No, still there</button>
              </div>
            </div>
          )}
          {tokenValid && i.status !== "resolved" && (
            <p className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground">You're viewing this as the original reporter. You'll be able to confirm or dispute the fix once it's marked resolved.</p>
          )}
          <div className="h-56 overflow-hidden rounded-2xl border">
            <LazyMap center={{ lat: i.lat, lng: i.lng }} zoom={16} picked={{ lat: i.lat, lng: i.lng }} />
          </div>
          <div className="divide-y rounded-2xl border bg-card">
            <Row icon={<MapPin className="h-4 w-4" />} label="Location">{i.landmark || `${i.lat.toFixed(5)}, ${i.lng.toFixed(5)}`}</Row>
            <Row icon={<Building2 className="h-4 w-4" />} label="Recorded ownership">{i.department ?? "Ownership review pending"}<span className="block text-xs text-muted-foreground">Internal record — not an official referral</span></Row>
            <Row icon={<CalendarClock className="h-4 w-4" />} label="Siddi review target">
              {i.sla_due_at ? new Date(i.sla_due_at).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—"}
              <span className="block text-xs text-muted-foreground">{SEVERITY_META[i.severity as Severity].label} internal target — not a government commitment</span>
            </Row>
            <Row icon={<Users className="h-4 w-4" />} label="Citizens affected">{i.support_count + 1} report{i.support_count ? "s" : ""}</Row>
            <div className="flex items-center justify-between p-4 text-sm"><span className="text-muted-foreground">Severity</span><SeverityTag severity={i.severity} /></div>
            <div className="flex items-center justify-between p-4 text-sm"><span className="text-muted-foreground">Reported</span><span>{new Date(i.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span></div>
          </div>
          <CivicInfo lat={i.lat} lng={i.lng} category={i.category} subcategory={i.subcategory} snapshot={i.routing_snapshot} />
        </aside>
      </div>
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 p-4 text-sm">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{children}</p></div>
    </div>
  );
}
