import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Building2, CalendarClock, Copy, Eye, EyeOff, MapPin, ShieldAlert, ThumbsDown, ThumbsUp, Users } from "lucide-react";
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

export const Route = createFileRoute("/_citizen/issues/$ref")({
  head: ({ params }) => ({
    meta: [
      { title: `Issue ${params.ref} — CivicFix` },
      { name: "description", content: `Public status, location and full action history for civic issue ${params.ref}.` },
      { property: "og:title", content: `Civic issue ${params.ref} — CivicFix` },
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
    refetchInterval: 30000,
    queryFn: async () => {
      return (await publicCases(ref))[0] ?? null;
    },
  });
  const events = useQuery({
    queryKey: ["issue-events", issue.data?.id],
    enabled: !!issue.data?.id,
    refetchInterval: 30000,
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Link to="/explore" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All issues</Link>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <p className="flex flex-wrap items-center gap-2 text-sm font-bold tracking-wide">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${unresolved ? "bg-destructive" : "bg-success"}`} />
            <span className={i.severity === "critical" || i.severity === "high" ? "text-destructive" : "text-foreground"}>{severityLabel}</span>
            <span className="text-muted-foreground">·</span>
            <span className={unresolved ? "text-destructive" : "text-success"}>{statusLabel}</span>
            <span className="font-mono font-normal text-muted-foreground">{i.ref_code}</span>
          </p>
          <h1 className="text-3xl font-bold sm:text-4xl">{i.title}</h1>
          <p className="text-muted-foreground">{cat.emoji} {cat.label}{i.subcategory ? ` · ${i.subcategory}` : ""}</p>
          <p className="text-sm text-muted-foreground">Reported {ageDays === 0 ? "today" : `${ageDays}d ago`}{unresolved && ageDays > 0 ? ` · ${ageDays}d unresolved` : ""}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleFollow} className="inline-flex h-10 items-center gap-2 rounded-lg border bg-card px-4 text-sm font-semibold hover:bg-secondary">
            {following ? <><EyeOff className="h-4 w-4" /> Unfollow</> : <><Eye className="h-4 w-4" /> Follow</>}
          </button>
          <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/issues/${ref}`); toast.success("Public link copied"); }} className="inline-flex h-10 items-center gap-2 rounded-lg border bg-card px-4 text-sm font-semibold hover:bg-secondary">
            <Copy className="h-4 w-4" /> Share
          </button>
        </div>
      </div>

      <div className="mt-6"><JourneyBar status={i.status} /></div>
      {i.duplicate_of && <section className="mt-6 space-y-3 border-y bg-primary-soft p-4"><h2 className="font-semibold">This original report is linked to an underlying issue</h2><p className="text-sm">Your reference, photo and history are preserved. Current work and resolution are tracked on the canonical issue.</p>{canonical.data?<Button asChild><Link to="/issues/$ref" params={{ref:canonical.data.ref_code}}>Track {canonical.data.ref_code} · {canonical.data.title}</Link></Button>:<p className="text-sm">{canonical.isError?'The linked issue could not be loaded.':'Loading linked issue…'}</p>}</section>}
      {i.duplicate_candidate_id && !i.duplicate_of && <p className="mt-4 border-l-2 border-warning pl-3 text-sm text-muted-foreground">A possible matching report is awaiting staff review. This report has not been merged.</p>}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {!i.duplicate_of && <StaffResponse c={i} />}
          {i.photo_url && <img src={i.photo_url} alt={i.title} className="max-h-[520px] w-full rounded-3xl border object-cover shadow-soft" />}
          {photo.data?.url&&<details className="border-y py-4"><summary className="cursor-pointer text-sm font-semibold">Annotated report photo</summary><img src={photo.data.url} alt="Separate annotated report evidence with report location and available capture metadata" className="mt-4 w-full rounded-lg" loading="lazy"/><p className="mt-2 text-xs text-muted-foreground">A separate copy. The untouched original stays private; report location is not proof of photo capture location.</p></details>}
          {i.safety_warning && <div className="flex gap-3 rounded-2xl bg-destructive-soft p-4 text-sm text-destructive"><ShieldAlert className="h-5 w-5 shrink-0" />{i.safety_warning}</div>}
          {(i.summary || i.description) && (
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="text-lg font-semibold">About this issue</h2>
              {i.summary && <p className="mt-2">{i.summary}</p>}
              {i.description && i.description !== i.summary && <p className="mt-3 border-l-2 pl-3 text-sm italic text-muted-foreground">"{i.description}"</p>}
            </div>
          )}
          <div className="rounded-2xl border bg-card p-6">
            <h2 className="mb-5 text-lg font-semibold">Action history</h2>
            {events.isError?<div role="alert"><p>History could not be loaded.</p><Button variant="outline" onClick={()=>events.refetch()}>Retry history</Button></div>:<Timeline events={events.data ?? []} />}
          </div>
          <IssueEvidence issueId={i.id} />
        </div>
        <aside className="space-y-4">
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
            <Row icon={<CalendarClock className="h-4 w-4" />} label="CivicFix review target">
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
