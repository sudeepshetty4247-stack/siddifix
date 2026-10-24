import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, STATUSES, STATUS_META, SEVERITIES, SEVERITY_META, categoryById, isOverdue, type IssueStatus } from "@/lib/civic";
import { StatusBadge, SeverityTag } from "@/components/civic/StatusBadge";
import { Timeline, type EventRow } from "@/components/civic/Timeline";
import { LazyMap } from "@/components/civic/LazyMap";
import { useRoles } from "./staff";

export const Route = createFileRoute("/_authenticated/staff/issues/$id")({
  component: StaffIssue,
});

// Allowed lifecycle transitions (Civic Continuity: no silent jumps).
const TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  needs_classification: ["under_review", "rejected"],
  submitted: ["under_review", "assigned", "rejected"],
  under_review: ["assigned", "rejected"],
  assigned: ["in_progress", "under_review", "rejected"],
  in_progress: ["resolved", "assigned"],
  resolved: ["closed", "reopened"],
  rejected: ["reopened"],
  reopened: ["under_review", "assigned", "in_progress"],
  closed: ["reopened"],
};

function StaffIssue() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const roles = useRoles();
  const [note, setNote] = useState("");
  const [nextStatus, setNextStatus] = useState<IssueStatus | "">("");
  const [busy, setBusy] = useState(false);

  const issue = useQuery({
    queryKey: ["staff-issue", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("issues").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const events = useQuery({
    queryKey: ["staff-events", id],
    queryFn: async () => {
      const { data } = await supabase.from("issue_events").select("*").eq("issue_id", id).order("created_at");
      return (data ?? []) as EventRow[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["staff-issue", id] });
    qc.invalidateQueries({ queryKey: ["staff-events", id] });
    qc.invalidateQueries({ queryKey: ["staff-queue"] });
    qc.invalidateQueries({ queryKey: ["staff-all"] });
  };
  const actor = () => ({ actor_id: roles.data!.userId, actor_label: roles.data?.roles.includes("admin") ? "CivicFix administrator" : "CivicFix staff" });

  async function logEvent(e: { kind: string; note?: string | null; from_status?: IssueStatus | null; to_status?: IssueStatus | null }) {
    const { error } = await supabase.from("issue_events").insert({ issue_id: id, ...actor(), ...e });
    if (error) throw error;
  }

  async function applyStatus() {
    if (!nextStatus || !issue.data) return;
    const requiresNote = nextStatus === "rejected" || nextStatus === "resolved";
    if (requiresNote && note.trim().length < 5) return toast.error(nextStatus === "rejected" ? "Please give a reason for rejecting." : "Please describe what was done to resolve it.");
    setBusy(true);
    try {
      const from = issue.data.status as IssueStatus;
      const { error } = await supabase.from("issues").update({ status: nextStatus }).eq("id", id);
      if (error) throw error;
      await logEvent({ kind: "status_change", from_status: from, to_status: nextStatus, note: note.trim() || null });
      setNote("");
      setNextStatus("");
      toast.success(`Status changed to ${STATUS_META[nextStatus].label}`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function postNote() {
    if (note.trim().length < 2) return;
    setBusy(true);
    try {
      await logEvent({ kind: "note", note: note.trim() });
      setNote("");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function updateField(patch: { category?: string; severity?: (typeof SEVERITIES)[number]; department?: string }, label: string) {
    const { error } = await supabase.from("issues").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    await logEvent({ kind: patch.department ? "assigned" : "note", note: label }).catch(() => {});
    toast.success("Updated");
    refresh();
  }

  if (issue.isLoading || !issue.data) return <div className="p-8"><div className="h-96 animate-pulse rounded-2xl bg-muted" /></div>;
  const i = issue.data;
  const options = TRANSITIONS[i.status as IssueStatus] ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <Link to="/staff/queue" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Queue</Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={i.status} />
            <SeverityTag severity={i.severity} />
            {isOverdue(i) && <span className="rounded-full bg-warning px-2 py-0.5 text-xs font-semibold text-warning-foreground">Overdue</span>}
            <span className="font-mono text-sm text-muted-foreground">{i.ref_code}</span>
          </div>
          <h1 className="text-2xl font-bold sm:text-3xl">{i.title}</h1>
        </div>
        <Link to="/issues/$ref" params={{ ref: i.ref_code }} target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-card px-3 text-sm font-medium"><ExternalLink className="h-4 w-4" /> Public page</Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-5 shadow-soft">
            <h2 className="font-semibold">Take action</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {options.map((s) => (
                <button key={s} onClick={() => setNextStatus(nextStatus === s ? "" : s)} className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${nextStatus === s ? "border-primary bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
                  → {STATUS_META[s].label}
                </button>
              ))}
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} placeholder={nextStatus === "rejected" ? "Reason for rejection (visible to the public)" : nextStatus === "resolved" ? "What was done? (visible to the public)" : "Add a public update or note…"} className="mt-4 w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <div className="mt-3 flex justify-end gap-2">
              {!nextStatus && <button disabled={busy || note.trim().length < 2} onClick={postNote} className="inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold disabled:opacity-40"><Send className="h-4 w-4" /> Post update</button>}
              {nextStatus && <button disabled={busy} onClick={applyStatus} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm: {STATUS_META[nextStatus].label}</button>}
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-soft">
            <h2 className="mb-5 font-semibold">Audit trail</h2>
            <Timeline events={events.data ?? []} />
          </div>
        </div>
        <aside className="space-y-4">
          {i.photo_url && <img src={i.photo_url} alt="" className="w-full rounded-2xl border object-cover" />}
          <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
            <h2 className="font-semibold">Classification</h2>
            {i.ai_confidence !== null && <p className="text-xs text-muted-foreground">AI suggestion confidence: {Math.round((i.ai_confidence ?? 0) * 100)}%</p>}
            <label className="block text-sm">
              <span className="text-muted-foreground">Category</span>
              <select value={i.category} onChange={(e) => updateField({ category: e.target.value }, `Reclassified as ${categoryById(e.target.value).label}`)} className="mt-1 h-10 w-full rounded-lg border bg-background px-2">
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Severity</span>
              <select value={i.severity} onChange={(e) => updateField({ severity: e.target.value as "low" }, `Severity set to ${SEVERITY_META[e.target.value as "low"].label}`)} className="mt-1 h-10 w-full rounded-lg border bg-background px-2">
                {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_META[s].label}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Responsible authority / team</span>
              <select value={i.department ?? ""} onChange={(e) => updateField({ department: e.target.value }, `Ownership handed to ${e.target.value}`)} className="mt-1 h-10 w-full rounded-lg border bg-background px-2">
                <option value="" disabled>Choose…</option>
                {[...new Set([i.department, ...CATEGORIES.map((c) => c.authority)])].filter(Boolean).map((a) => <option key={a!} value={a!}>{a}</option>)}
              </select>
            </label>
          </div>
          <div className="rounded-2xl border bg-card p-5 text-sm shadow-soft">
            {i.summary && <p>{i.summary}</p>}
            {i.description && <p className="mt-2 italic text-muted-foreground">"{i.description}"</p>}
            {i.landmark && <p className="mt-3"><span className="text-muted-foreground">Landmark:</span> {i.landmark}</p>}
            <p className="mt-1"><span className="text-muted-foreground">Due:</span> {i.sla_due_at ? new Date(i.sla_due_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}</p>
            <p className="mt-1"><span className="text-muted-foreground">Linked reports:</span> {i.support_count}</p>
          </div>
          <div className="h-56 overflow-hidden rounded-2xl border"><LazyMap center={{ lat: i.lat, lng: i.lng }} zoom={16} picked={{ lat: i.lat, lng: i.lng }} /></div>
          <p className="text-xs text-muted-foreground">Status options: {STATUSES.length} lifecycle states; only valid next steps are shown.</p>
        </aside>
      </div>
    </div>
  );
}
