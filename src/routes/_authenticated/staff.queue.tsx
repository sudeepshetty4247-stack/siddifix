import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Search, RefreshCw } from "lucide-react";
import { CATEGORIES, OPEN_STATUSES, STATUSES, STATUS_META, categoryById, isOverdue, timeAgo, SEVERITIES, SEVERITY_META } from "@/lib/civic";
import { StatusBadge, SeverityTag } from "@/components/civic/StatusBadge";
import { staffQueue } from "@/lib/staff-queue.functions";
import { listTeams } from "@/lib/teams.functions";
import { getDirectory } from "@/lib/directory.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/staff/queue")({
  head: () => ({ meta: [{ title: "Staff issue queue — Siddi" }, { name: "description", content: "Search and filter civic reports awaiting review or action." }, { property: "og:title", content: "Staff issue queue — Siddi" }, { property: "og:description", content: "Search and filter civic reports awaiting review or action." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Queue,
});

const VIEWS = ["open", "unassigned", "assigned", "rejected assignments", "overdue", "escalated", "resolved", "linked reports", "duplicate candidates", "all"] as const;

function Queue() {
  const navigate = useNavigate();
  const runQueue = useServerFn(staffQueue);
  const [view, setView] = useState<(typeof VIEWS)[number]>("open");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [sev, setSev] = useState("");
  const [team, setTeam] = useState("");
  const [ward, setWard] = useState("");
  const [ack, setAck] = useState("");
  const [search, setSearch] = useState("");

  // Every filter is applied in the database; field workers only ever receive
  // rows inside their category/ward scope from the backend itself.
  const q = useQuery({
    queryKey: ["staff-queue", cat, status, sev, team, ward, ack, search, view === "overdue"],
    queryFn: () =>
      runQueue({
        data: {
          category: cat || null,
          status: status || null,
          severity: sev || null,
          ward: ward || null,
          team: team || null,
          ack: (ack || null) as "acknowledged" | "unacknowledged" | null,
          overdue: view === "overdue" ? true : null,
          search: search || null,
        },
      }),
    refetchInterval: 30_000,
  });

  const teams = useQuery({ queryKey: ["staff-teams"], queryFn: () => useServerFn(listTeams)(), staleTime: 60_000 });
  const directory = useQuery({ queryKey: ["directory"], queryFn: () => useServerFn(getDirectory)(), staleTime: 300_000 });
  const wards = (directory.data?.wards ?? []).filter((w) => w.active).map((w) => ({ id: w.identifier, label: `${w.name} (${w.ward_number ?? "—"})` }));

  const rows = (q.data ?? []).filter((i) => {
    if (view === "duplicate candidates" && !i.duplicate_candidate_id) return false;
    if (view === "open" && !OPEN_STATUSES.includes(i.status as never)) return false;
    if (view === "unassigned" && (i.authority_id || !OPEN_STATUSES.includes(i.status as never))) return false;
    if (view === "assigned" && !i.authority_id && !i.team_id) return false;
    if (view === "rejected assignments" && i.assignment_state !== "rejected") return false;
    if (view === "escalated" && !i.escalated_at) return false;
    if (view === "resolved" && !["resolved", "closed"].includes(i.status)) return false;
    if (view === "linked reports" && !i.duplicate_of) return false;
    return true;
  });

  const sel = "h-10 rounded-lg border bg-card px-3 text-sm";
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Issue Queue</h1>
          <p className="text-muted-foreground">{q.isLoading ? "Loading…" : `${rows.length} issue${rows.length === 1 ? "" : "s"} in your scope`}</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl bg-secondary p-1 text-sm">
          {VIEWS.map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn("rounded-lg px-4 py-1.5 font-medium capitalize", view === v ? "bg-card shadow-soft" : "text-muted-foreground")}>{v}</button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
        <div className="relative flex-1 md:min-w-56">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, reference, landmark" className="h-10 w-full rounded-lg border bg-card pl-9 pr-3 text-sm" />
        </div>
        <select className={sel} value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
        <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}</select>
        <select className={sel} value={sev} onChange={(e) => setSev(e.target.value)}><option value="">Any severity</option>{SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_META[s].label}</option>)}</select>
        <select className={sel} value={team} onChange={(e) => setTeam(e.target.value)}><option value="">Any team</option>{(teams.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <select className={sel} value={ward} onChange={(e) => setWard(e.target.value)}><option value="">Any ward</option>{wards.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</select>
        <select className={sel} value={ack} onChange={(e) => setAck(e.target.value)}><option value="">Ack: any</option><option value="acknowledged">Acknowledged</option><option value="unacknowledged">Not acknowledged</option></select>
      </div>

      {q.isError ? (
        <div className="rounded-2xl border bg-card p-10 text-center shadow-soft">
          <p className="font-semibold">The queue couldn't be loaded.</p>
          <p className="mt-1 text-sm text-muted-foreground">Your connection or the database may have hiccuped. Nothing was changed.</p>
          <button onClick={() => q.refetch()} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-ink-foreground"><RefreshCw className="h-4 w-4" /> Try again</button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="p-3">Issue</th><th className="p-3">Category</th><th className="p-3">Ward</th><th className="p-3">Team</th><th className="p-3">Severity</th><th className="p-3">Status</th><th className="p-3">Due</th><th className="p-3">Reported</th></tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((i) => (
                  <tr key={i.id} onClick={() => navigate({ to: "/staff/issues/$id", params: { id: i.id } })} className="cursor-pointer hover:bg-secondary/60">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {i.photo_url ? <img src={i.photo_url} alt="" className="h-10 w-10 rounded-lg object-cover" loading="lazy" /> : <div className="h-10 w-10 rounded-lg bg-muted" />}
                        <div className="min-w-0">
                          <p className="max-w-xs truncate font-medium">{i.title}</p>
                          <p className="font-mono text-xs text-muted-foreground">{i.ref_code}{i.support_count > 0 && ` · +${i.support_count} linked`}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 whitespace-nowrap">{categoryById(i.category).emoji} {categoryById(i.category).label.split(" ")[0]}</td>
                    <td className="max-w-32 truncate p-3 text-muted-foreground">{i.ward_name ?? "—"}</td>
                    <td className="max-w-32 truncate p-3 text-muted-foreground">{i.team_name ?? "—"}</td>
                    <td className="p-3"><SeverityTag severity={i.severity} /></td>
                    <td className="p-3"><StatusBadge status={i.status} /></td>
                    <td className={cn("p-3 whitespace-nowrap", isOverdue(i) && "font-semibold text-destructive")}>{i.sla_due_at ? new Date(i.sla_due_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}</td>
                    <td className="p-3 whitespace-nowrap text-muted-foreground">{timeAgo(i.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {q.isLoading && <p className="p-10 text-center text-sm text-muted-foreground">Loading issues…</p>}
          {!q.isLoading && rows.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">No issues in this view within your scope.</p>}
        </div>
      )}
    </div>
  );
}
