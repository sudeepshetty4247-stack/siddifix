import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ShieldCheck, ShieldAlert, AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";
import { listAuditLog, systemHealth } from "@/lib/staff-queue.functions";
import { useRoles } from "./staff";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/staff/audit")({
  head: () => ({ meta: [{ title: "Audit log & system health — Siddi" }, { name: "description", content: "Administrator view of every staff action and live system checks." }, { property: "og:title", content: "Audit log & system health — Siddi" }, { property: "og:description", content: "Administrator view of every staff action and live system checks." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: AuditPage,
});

const AREAS = ["All", "Case", "Assignment", "Duplicates", "Notifications", "Directory & teams"] as const;

function AuditPage() {
  const roles = useRoles();
  const isAdmin = roles.data?.roles.includes("admin") ?? false;
  const runAudit = useServerFn(listAuditLog);
  const runHealth = useServerFn(systemHealth);
  const [area, setArea] = useState<(typeof AREAS)[number]>("All");

  const audit = useQuery({ queryKey: ["audit-log"], queryFn: () => runAudit(), enabled: isAdmin, refetchInterval: 60_000, retry: false });
  const health = useQuery({ queryKey: ["system-health"], queryFn: () => runHealth(), enabled: isAdmin, refetchInterval: 60_000, retry: false });

  if (roles.isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md rounded-3xl border bg-card p-8 text-center shadow-lift">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-4 text-2xl font-bold">Administrators only</h1>
          <p className="mt-2 text-sm text-muted-foreground">The audit log and system health checks are restricted to administrators.</p>
        </div>
      </div>
    );
  }

  const entries = (audit.data ?? []).filter((e) => area === "All" || e.area === area);
  const healthIcon = (s: string) => s === "ok" ? <CheckCircle2 className="h-5 w-5 text-success" /> : s === "warning" ? <AlertTriangle className="h-5 w-5 text-warning" /> : <ShieldAlert className="h-5 w-5 text-destructive" />;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-8">
      <div>
        <h1 className="text-3xl font-bold">Audit Log & System Health</h1>
        <p className="text-muted-foreground">Every recorded staff action and live system checks. Read-only — audit records cannot be edited or deleted.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">System health</h2>
        {health.isLoading ? (
          <p className="text-sm text-muted-foreground">Running checks…</p>
        ) : health.isError ? (
          <div className="rounded-2xl border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Health checks couldn't run right now.</p>
            <button onClick={() => health.refetch()} className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold"><RefreshCw className="h-4 w-4" /> Retry</button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(health.data ?? []).map((c) => (
              <div key={c.key} className="flex gap-3 rounded-2xl border bg-card p-4 shadow-soft">
                <div className="mt-0.5 shrink-0">{healthIcon(c.status)}</div>
                <div>
                  <p className="text-sm font-semibold">{c.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Audit events</h2>
          <div className="flex flex-wrap gap-1 rounded-xl bg-secondary p-1 text-sm">
            {AREAS.map((a) => (
              <button key={a} onClick={() => setArea(a)} className={cn("rounded-lg px-3 py-1.5 font-medium", area === a ? "bg-card shadow-soft" : "text-muted-foreground")}>{a}</button>
            ))}
          </div>
        </div>

        {audit.isError ? (
          <div className="rounded-2xl border bg-card p-10 text-center">
            <p className="font-semibold">The audit log couldn't be loaded.</p>
            <button onClick={() => audit.refetch()} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-ink-foreground"><RefreshCw className="h-4 w-4" /> Try again</button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="p-3">When</th><th className="p-3">Area</th><th className="p-3">Action</th><th className="p-3">Detail</th><th className="p-3">Actor</th><th className="p-3">Case</th></tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((e, i) => (
                    <tr key={i}>
                      <td className="p-3 whitespace-nowrap text-muted-foreground">{new Date(e.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="p-3 whitespace-nowrap">{e.area}</td>
                      <td className="p-3 whitespace-nowrap font-medium">{e.action}</td>
                      <td className="max-w-md truncate p-3 text-muted-foreground">{e.detail}</td>
                      <td className="p-3 whitespace-nowrap text-muted-foreground">{e.actor}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{e.ref ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {audit.isLoading && <p className="p-10 text-center text-sm text-muted-foreground">Loading audit events…</p>}
            {!audit.isLoading && entries.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">No audit events recorded in this area yet.</p>}
          </div>
        )}
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" /> Audit records are write-once in the database. Passwords, secrets and private tracking tokens are never stored or shown here.</p>
      </section>
    </div>
  );
}
