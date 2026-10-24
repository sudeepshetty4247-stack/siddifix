import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlarmClock, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { categoryById, timeAgo } from "@/lib/civic";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/staff/overdue")({
  head: () => ({ meta: [{ title: "Overdue & escalated cases — CivicFix" }, { name: "description", content: "Cases past their promised completion date and escalated cases needing supervisor attention." }, { property: "og:title", content: "Overdue & escalated cases — CivicFix" }, { property: "og:description", content: "Cases past their promised completion date and escalated cases needing supervisor attention." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: OverduePage,
});

const CLOSED = ["resolved", "closed", "rejected"];

type Row = {
  id: string; ref_code: string; title: string; category: string; severity: string; status: string;
  eta_at: string | null; escalated_at: string | null; created_at: string; department: string | null;
  routing_snapshot: { ward?: { name?: string; ward_number?: number | null } | null } | null;
};

function wardLabel(r: Row) {
  const w = r.routing_snapshot?.ward;
  return w?.name ? `${w.name}${w.ward_number ? ` · Ward ${w.ward_number}` : ""}` : "Ward not resolved";
}

function overdueBy(eta: string) {
  const ms = Date.now() - new Date(eta).getTime();
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"} overdue`;
  const hours = Math.floor(ms / 3600000);
  return hours >= 1 ? `${hours} hour${hours === 1 ? "" : "s"} overdue` : "Just became overdue";
}

function OverduePage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["overdue-cases"],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issues")
        .select("id, ref_code, title, category, severity, status, eta_at, escalated_at, created_at, department, routing_snapshot")
        .is("duplicate_of", null)
        .not("status", "in", `(${CLOSED.join(",")})`)
        .order("eta_at", { ascending: true, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      const rows = (data ?? []) as Row[];
      const now = Date.now();
      return {
        overdue: rows.filter((r) => r.eta_at && new Date(r.eta_at).getTime() < now),
        escalated: rows.filter((r) => r.escalated_at),
      };
    },
  });
  const [escalating, setEscalating] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function escalate(id: string) {
    if (reason.trim().length < 5) { toast.error("Give a reason of at least 5 characters"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("assign_civic_issue", { _id: id, _authority: null, _action: "escalate", _reason: reason.trim() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Case escalated");
    setEscalating(null); setReason("");
    qc.invalidateQueries({ queryKey: ["overdue-cases"] });
  }

  const overdue = q.data?.overdue ?? [];
  const escalated = q.data?.escalated ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 sm:p-8">
      <div>
        <h1 className="text-3xl font-bold">Overdue & Escalated</h1>
        <p className="text-muted-foreground">Cases that passed the completion date staff promised citizens, and cases escalated for supervisor attention. Refreshes every 30 seconds. These are CivicFix follow-up targets, not official government deadlines.</p>
      </div>
      {q.error && <p className="rounded-xl bg-destructive-soft p-4 text-sm text-destructive">{(q.error as Error).message}</p>}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold"><AlarmClock className="h-5 w-5 text-destructive" /> Past promised date ({overdue.length})</h2>
        {overdue.length === 0 && !q.isLoading && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No case is past its promised date right now.</p>}
        {overdue.map((r) => (
          <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{r.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.ref_code} · {categoryById(r.category)?.label ?? r.category} · {wardLabel(r)} · promised {r.eta_at ? new Date(r.eta_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                  {r.department ? ` · ${r.department}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-destructive-soft px-3 py-1 text-xs font-semibold text-destructive">{r.eta_at ? overdueBy(r.eta_at) : "Overdue"}</span>
                {r.escalated_at && <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning-foreground">Escalated {timeAgo(r.escalated_at)}</span>}
                <Link to="/staff/issues/$id" params={{ id: r.id }} className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-secondary">Open case</Link>
                {!r.escalated_at && <Button size="sm" variant="outline" onClick={() => { setEscalating(escalating === r.id ? null : r.id); setReason(""); }}>Escalate</Button>}
              </div>
            </div>
            {escalating === r.id && (
              <div className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row">
                <input value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} placeholder="Reason for escalation (required, audited)" className="h-10 flex-1 rounded-lg border bg-background px-3 text-sm" />
                <Button disabled={busy} onClick={() => escalate(r.id)}>Escalate <ArrowUpRight className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold"><ArrowUpRight className="h-5 w-5 text-warning-foreground" /> Escalated cases ({escalated.length})</h2>
        {escalated.length === 0 && !q.isLoading && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No escalated cases right now.</p>}
        {escalated.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-soft">
            <div className="min-w-0">
              <p className="font-semibold">{r.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.ref_code} · {categoryById(r.category)?.label ?? r.category} · {wardLabel(r)} · escalated {r.escalated_at ? timeAgo(r.escalated_at) : ""}</p>
            </div>
            <Link to="/staff/issues/$id" params={{ id: r.id }} className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-secondary">Open case</Link>
          </div>
        ))}
      </section>
      {q.isLoading && <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>}
    </div>
  );
}
