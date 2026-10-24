import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { listRoutingExceptions, assignTeam, listTeams } from "@/lib/teams.functions";
import { categoryById, timeAgo } from "@/lib/civic";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/staff/routing")({
  head: () => ({ meta: [{ title: "Routing exceptions — Siddi" }, { name: "description", content: "Cases that need a supervisor to choose the responsible team." }, { property: "og:title", content: "Routing exceptions — Siddi" }, { property: "og:description", content: "Cases that need a supervisor to choose the responsible team." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: RoutingExceptions,
});

type ExceptionCase = Awaited<ReturnType<typeof listRoutingExceptions>>[number];

function wardLabel(c: ExceptionCase): string {
  const ward = (c.routing_snapshot as { ward?: { name?: string; ward_number?: number | null } | null } | null)?.ward;
  return ward?.name ? `${ward.name}${ward.ward_number ? ` · Ward ${ward.ward_number}` : ""}` : "Ward not resolved";
}

function RoutingExceptions() {
  const list = useServerFn(listRoutingExceptions);
  const teamsFn = useServerFn(listTeams);
  const qc = useQueryClient();
  const cases = useQuery({ queryKey: ["routing-exceptions"], queryFn: () => list() });
  const teams = useQuery({ queryKey: ["teams"], queryFn: () => teamsFn() });
  const [assigning, setAssigning] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <div>
        <h1 className="text-3xl font-bold">Routing Exceptions</h1>
        <p className="text-muted-foreground">These cases could not be matched to an active team automatically. Choose a team with a reason — every assignment is audited.</p>
      </div>
      {cases.error && <p className="rounded-xl bg-destructive-soft p-4 text-sm text-destructive">{(cases.error as Error).message}</p>}
      {cases.data?.length === 0 && (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <p className="font-semibold">No routing exceptions</p>
          <p className="mt-1 text-sm text-muted-foreground">Every incoming case has matched an active team, or no cases have arrived yet.</p>
        </div>
      )}
      <div className="space-y-3">
        {(cases.data ?? []).map((c) => (
          <div key={c.id} className="rounded-2xl border bg-card p-4 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 shrink-0 text-warning-foreground" />{c.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.ref_code} · {categoryById(c.category)?.label ?? c.category} · {wardLabel(c)} · {timeAgo(c.created_at)}
                  {c.landmark ? ` · ${c.landmark}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link to="/staff/issues/$id" params={{ id: c.id }} className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-secondary">Open case</Link>
                <Button size="sm" onClick={() => setAssigning(assigning === c.id ? null : c.id)}>{assigning === c.id ? "Close" : "Assign team"}</Button>
              </div>
            </div>
            {assigning === c.id && (
              <AssignForm
                teams={(teams.data ?? []).filter((t) => t.active)}
                onAssign={async (teamId, reason) => {
                  try {
                    await assignTeam({ data: { issueId: c.id, teamId, reason } });
                    toast.success("Team assigned");
                    setAssigning(null);
                    qc.invalidateQueries({ queryKey: ["routing-exceptions"] });
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              />
            )}
          </div>
        ))}
        {cases.isLoading && <p className="p-6 text-center text-sm text-muted-foreground">Loading exceptions…</p>}
      </div>
    </div>
  );
}

function AssignForm({ teams, onAssign }: { teams: Awaited<ReturnType<typeof listTeams>>; onAssign: (teamId: string, reason: string) => Promise<void> }) {
  const [teamId, setTeamId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-[1fr_2fr_auto]">
      <label className="text-sm"><span className="text-muted-foreground">Team</span>
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm">
          <option value="">Choose a team…</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.department}</option>)}
        </select>
      </label>
      <label className="text-sm"><span className="text-muted-foreground">Reason (required, shown in the audit trail)</span>
        <input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Ward 65 roads work is handled by this team" className="mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm" />
      </label>
      <div className="flex items-end">
        <Button disabled={!teamId || reason.trim().length < 3 || busy} onClick={async () => { setBusy(true); await onAssign(teamId, reason.trim()); setBusy(false); }}>
          Assign <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      {teams.length === 0 && <p className="text-sm text-muted-foreground sm:col-span-3">No active teams yet — an admin can create them under Team Management.</p>}
    </div>
  );
}
