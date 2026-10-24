import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Timer, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useRoles } from "./staff";
import type { Severity } from "@/lib/civic";

export const Route = createFileRoute("/_authenticated/staff/targets")({
  head: () => ({ meta: [{ title: "Service targets — Siddi" }, { name: "description", content: "Configure internal acknowledgement and resolution targets by category and severity." }, { property: "og:title", content: "Service targets — Siddi" }, { property: "og:description", content: "Internal Siddi service targets by category and severity." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: TargetsPage,
});

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
type Row = { category: string; severity: Severity; ack_hours: number; resolve_hours: number; version: number; active: boolean; updated_at: string };

function TargetsPage() {
  const roles = useRoles();
  const isAdmin = roles.data?.roles.includes("admin") ?? false;
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["service-targets"], queryFn: async () => {
    const r = await supabase.from("service_targets").select("category,severity,ack_hours,resolve_hours,version,active,updated_at").order("category");
    if (r.error) throw r.error; return r.data as Row[];
  } });
  const [edit, setEdit] = useState<Record<string, { ack: string; res: string; active: boolean }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const categories = [...new Set((q.data ?? []).map(r => r.category))];

  async function save(row: Row) {
    const k = `${row.category}:${row.severity}`; const e = edit[k]; if (!e) return;
    setSaving(k);
    const r = await supabase.rpc("admin_upsert_service_target", { _category: row.category, _severity: row.severity, _ack_hours: Number(e.ack), _resolve_hours: Number(e.res), _active: e.active, _notes: "Internal Siddi target; not an official government commitment." });
    setSaving(null);
    if (r.error) { toast.error(r.error.message); return; }
    toast.success(`Saved ${row.category} · ${row.severity}. Applies to new reports.`);
    setEdit(prev => { const n = { ...prev }; delete n[k]; return n; });
    qc.invalidateQueries({ queryKey: ["service-targets"] });
  }

  if (roles.isLoading || q.isPending) return <p role="status" className="p-6 text-sm text-muted-foreground">Loading service targets…</p>;
  if (q.isError) return <p role="alert" className="p-6 text-sm">Service targets couldn't be loaded.</p>;
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Timer className="h-6 w-6 text-primary" />Service targets</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Each new report gets an acknowledgement deadline and a resolution target from the matching rule (calendar hours from submission). The rule version is stored on the case, so later edits never rewrite old cases. These are internal Siddi follow-up targets — not official government deadlines. An hourly background job escalates cases that miss them.</p>
        {!isAdmin && <p className="mt-3 flex items-center gap-2 text-sm text-warning-foreground"><ShieldAlert className="h-4 w-4" />Read-only — only administrators can change targets.</p>}
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2">Category</th><th className="px-3 py-2">Severity</th><th className="px-3 py-2">Acknowledge within (h)</th><th className="px-3 py-2">Resolve within (h)</th><th className="px-3 py-2">Active</th><th className="px-3 py-2">Version</th><th className="px-3 py-2" /></tr></thead>
          <tbody>
            {categories.flatMap(c => SEVERITIES.map(s => (q.data ?? []).find(r => r.category === c && r.severity === s)).filter((r): r is Row => !!r)).map(row => {
              const k = `${row.category}:${row.severity}`; const e = edit[k];
              const cur = e ?? { ack: String(row.ack_hours), res: String(row.resolve_hours), active: row.active };
              const set = (p: Partial<typeof cur>) => setEdit(prev => ({ ...prev, [k]: { ...cur, ...p } }));
              return <tr key={k} className="border-t">
                <td className="px-3 py-2 font-medium capitalize">{row.category}</td>
                <td className="px-3 py-2 capitalize">{row.severity}</td>
                <td className="px-3 py-2"><input aria-label={`${k} acknowledgement hours`} disabled={!isAdmin} type="number" min={1} value={cur.ack} onChange={ev => set({ ack: ev.target.value })} className="h-9 w-24 rounded-md border bg-background px-2" /></td>
                <td className="px-3 py-2"><input aria-label={`${k} resolution hours`} disabled={!isAdmin} type="number" min={1} value={cur.res} onChange={ev => set({ res: ev.target.value })} className="h-9 w-24 rounded-md border bg-background px-2" /></td>
                <td className="px-3 py-2"><input aria-label={`${k} active`} disabled={!isAdmin} type="checkbox" checked={cur.active} onChange={ev => set({ active: ev.target.checked })} className="h-4 w-4" /></td>
                <td className="px-3 py-2 text-muted-foreground">v{row.version}</td>
                <td className="px-3 py-2 text-right">{isAdmin && e && <Button size="sm" disabled={saving === k} onClick={() => save(row)}>Save</Button>}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
