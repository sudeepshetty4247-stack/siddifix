import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useRoles } from "./staff";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2, CircleOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/civic";

export const Route = createFileRoute("/_authenticated/staff/notifications")({
  head: () => ({ meta: [{ title: "Notifications & handoffs — Siddi" }, { name: "description", content: "Every notification Siddi actually recorded, with honest delivery states." }, { property: "og:title", content: "Notifications & handoffs — Siddi" }, { property: "og:description", content: "Every notification Siddi actually recorded, with honest delivery states." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: NotificationsPage,
});

type Row = {
  id: string; issue_id: string; audience: string; channel: string; status: string; detail: string;
  attempts: number; created_at: string; issues: { ref_code: string; title: string } | null;
};

function statusBadge(s: string) {
  if (s === "posted" || s === "delivered" || s === "acknowledged") return { icon: CheckCircle2, cls: "bg-success-soft text-success", label: s === "posted" ? "Posted in app" : s };
  if (s === "not_configured") return { icon: CircleOff, cls: "bg-secondary text-muted-foreground", label: "External channel not configured" };
  if (s === "failed") return { icon: CircleOff, cls: "bg-destructive-soft text-destructive", label: "Failed" };
  return { icon: Loader2, cls: "bg-warning-soft text-warning-foreground", label: s };
}

function NotificationsPage() {
  const access = useRoles();
  const qc = useQueryClient();
  const reads = useQuery({queryKey:["notification-reads"],queryFn:async()=>{const r=await supabase.from("notification_reads").select("notification_id");if(r.error)throw r.error;return new Set((r.data??[]).map(n=>n.notification_id));}});
  async function markRead(id:string){if(!access.data?.userId)return;const r=await supabase.from("notification_reads").insert({notification_id:id,user_id:access.data.userId});if(!r.error)await qc.invalidateQueries({queryKey:["notification-reads"]});}

  const q = useQuery({
    queryKey: ["issue-notifications"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issue_notifications")
        .select("id, issue_id, audience, channel, status, detail, attempts, created_at, issues(ref_code, title)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold"><Bell className="h-7 w-7 text-primary" /> Notifications & Handoffs</h1>
        <p className="mt-1 text-muted-foreground">What Siddi actually did for each case — in-app updates, and external government channels only when one is genuinely configured. "Not configured" means no message was sent to any outside office.</p>
      </div>
      {q.error && <p className="rounded-xl bg-destructive-soft p-4 text-sm text-destructive">{(q.error as Error).message}</p>}
      {q.data?.length === 0 && (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <p className="font-semibold">No notifications recorded yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Entries appear here as cases are reported, acknowledged and updated.</p>
        </div>
      )}
      <div className="space-y-2">
        {(q.data ?? []).map((n) => {
          const b = statusBadge(n.status);
          return (
            <div key={n.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{n.detail}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {n.issues ? <Link to="/staff/issues/$id" params={{ id: n.issue_id }} className="font-semibold text-primary hover:underline">{n.issues.ref_code}</Link> : "Case"}{" "}
                  · {n.channel} · to {n.audience} · {timeAgo(n.created_at)}{n.attempts > 1 ? ` · ${n.attempts} attempts` : ""}
                </p>
              </div>
              {!reads.data?.has(n.id) && <Button variant="outline" size="sm" onClick={()=>markRead(n.id)}>Mark read</Button>}
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${b.cls}`}><b.icon className="h-3.5 w-3.5" />{b.label}</span>
            </div>
          );
        })}
        {q.isLoading && <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>}
      </div>
    </div>
  );
}
