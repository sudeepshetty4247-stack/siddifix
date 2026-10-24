import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, OPEN_STATUSES, STATUSES, STATUS_META, categoryById, isOverdue, timeAgo, SEVERITIES, SEVERITY_META } from "@/lib/civic";
import { StatusBadge, SeverityTag } from "@/components/civic/StatusBadge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/staff/queue")({
  head: () => ({ meta: [{ title: "Staff issue queue — CivicFix" }, { name: "description", content: "Search and filter civic reports awaiting review or action." }, { property: "og:title", content: "Staff issue queue — CivicFix" }, { property: "og:description", content: "Search and filter civic reports awaiting review or action." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Queue,
});

function Queue() {
  const navigate = useNavigate();
  const [view, setView] = useState<"open" | "overdue" | "all">("open");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [sev, setSev] = useState("");
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["staff-queue"],
    queryFn: async () => {
      const { data, error } = await supabase.from("issues").select("id, ref_code, title, category, severity, status, sla_due_at, created_at, landmark, department, support_count, photo_url").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data;
    },
  });
  const rows = (q.data ?? []).filter((i) => {
    if (view === "open" && !OPEN_STATUSES.includes(i.status as never)) return false;
    if (view === "overdue" && !isOverdue(i)) return false;
    if (cat && i.category !== cat) return false;
    if (status && i.status !== status) return false;
    if (sev && i.severity !== sev) return false;
    if (search && !`${i.title} ${i.ref_code} ${i.landmark ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const sel = "h-10 rounded-lg border bg-card px-3 text-sm";
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Issue Queue</h1>
          <p className="text-muted-foreground">{rows.length} issue{rows.length === 1 ? "" : "s"}</p>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1 text-sm">
          {(["open", "overdue", "all"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn("rounded-lg px-4 py-1.5 font-medium capitalize", view === v ? "bg-card shadow-soft" : "text-muted-foreground")}>{v}</button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, reference, landmark" className="h-10 w-full rounded-lg border bg-card pl-9 pr-3 text-sm" />
        </div>
        <select className={sel} value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
        <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}</select>
        <select className={sel} value={sev} onChange={(e) => setSev(e.target.value)}><option value="">Any severity</option>{SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_META[s].label}</option>)}</select>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-3">Issue</th><th className="p-3">Category</th><th className="p-3">Severity</th><th className="p-3">Status</th><th className="p-3">Due</th><th className="p-3">Reported</th></tr>
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
                  <td className="p-3"><SeverityTag severity={i.severity} /></td>
                  <td className="p-3"><StatusBadge status={i.status} /></td>
                  <td className={cn("p-3 whitespace-nowrap", isOverdue(i) && "font-semibold text-destructive")}>{i.sla_due_at ? new Date(i.sla_due_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}</td>
                  <td className="p-3 whitespace-nowrap text-muted-foreground">{timeAgo(i.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && !q.isLoading && <p className="p-10 text-center text-sm text-muted-foreground">No issues in this view.</p>}
      </div>
    </div>
  );
}
