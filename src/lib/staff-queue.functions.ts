import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Team-scoped issue queue (all filtering enforced in the database) ----------

const queueSchema = z.object({
  category: z.string().max(60).nullable(),
  status: z.string().max(40).nullable(),
  severity: z.string().max(20).nullable(),
  ward: z.string().max(60).nullable(),
  team: z.string().uuid().nullable(),
  ack: z.enum(["acknowledged", "unacknowledged"]).nullable(),
  overdue: z.boolean().nullable(),
  search: z.string().max(120).nullable(),
});

export const staffQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof queueSchema>) => queueSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: staff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff) throw new Error("Staff access required");
    const result = await context.supabase.rpc("staff_queue_issues", {
      _category: data.category ?? undefined,
      _status: data.status ?? undefined,
      _severity: data.severity ?? undefined,
      _ward: data.ward ?? undefined,
      _team: data.team ?? undefined,
      _ack: data.ack ?? undefined,
      _overdue: data.overdue ?? undefined,
      _search: data.search?.trim() || undefined,
      _limit: 500,
    });
    if (result.error) throw new Error(result.error.message);
    return result.data ?? [];
  });

// ---------- Admin audit log (merged, read-only, admin-only) ----------

export type AuditEntry = {
  at: string;
  area: string;
  action: string;
  detail: string;
  actor: string;
  ref: string | null;
};

type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown }> };

async function requireAdmin(supabase: RpcClient, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) throw new Error("Only administrators can view the audit log.");
}

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuditEntry[]> => {
    await requireAdmin(context.supabase as unknown as RpcClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [events, assignments, duplicates, notifications, directory, issues] = await Promise.all([
      supabaseAdmin.from("issue_events").select("issue_id, kind, from_status, to_status, note, actor_label, created_at").order("created_at", { ascending: false }).limit(300),
      supabaseAdmin.from("issue_assignments").select("issue_id, action, reason, actor_id, created_at").order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("issue_duplicate_reviews").select("report_id, candidate_id, decision, reason, actor_id, created_at").order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("issue_notifications").select("issue_id, audience, channel, status, detail, created_at").order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("civic_directory_audit").select("table_name, action, new_row, actor_id, created_at").order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("issues").select("id, ref_code").limit(2000),
    ]);

    const refById = new Map((issues.data ?? []).map((i) => [i.id, i.ref_code as string]));
    const entries: AuditEntry[] = [];

    for (const e of events.data ?? []) {
      const transition = e.from_status && e.to_status ? `${e.from_status} → ${e.to_status}` : null;
      entries.push({
        at: e.created_at,
        area: "Case",
        action: e.kind,
        detail: [transition, e.note].filter(Boolean).join(" — ") || "—",
        actor: e.actor_label ?? "CivicFix",
        ref: refById.get(e.issue_id) ?? null,
      });
    }
    for (const a of assignments.data ?? []) {
      entries.push({
        at: a.created_at,
        area: "Assignment",
        action: a.action,
        detail: a.reason,
        actor: `staff ${String(a.actor_id).slice(0, 8)}`,
        ref: refById.get(a.issue_id) ?? null,
      });
    }
    for (const d of duplicates.data ?? []) {
      entries.push({
        at: d.created_at,
        area: "Duplicates",
        action: d.decision,
        detail: d.reason,
        actor: `staff ${String(d.actor_id).slice(0, 8)}`,
        ref: refById.get(d.report_id) ?? null,
      });
    }
    for (const n of notifications.data ?? []) {
      entries.push({
        at: n.created_at,
        area: "Notifications",
        action: n.status === "failed" ? "delivery failed" : n.status,
        detail: `${n.channel} → ${n.audience}: ${n.detail}`,
        actor: "CivicFix",
        ref: refById.get(n.issue_id) ?? null,
      });
    }
    for (const d of directory.data ?? []) {
      const row = d.new_row as { name?: string; full_name?: string } | null;
      entries.push({
        at: d.created_at,
        area: "Directory & teams",
        action: `${d.table_name} ${d.action}`,
        detail: row?.name ?? row?.full_name ?? "—",
        actor: d.actor_id ? `staff ${String(d.actor_id).slice(0, 8)}` : "CivicFix",
        ref: null,
      });
    }

    entries.sort((a, b) => b.at.localeCompare(a.at));
    return entries.slice(0, 400);
  });

// ---------- System health (honest, admin-only; only real checks are reported) ----------

export type HealthCheck = { key: string; label: string; status: "ok" | "warning" | "error"; detail: string };

export const systemHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HealthCheck[]> => {
    await requireAdmin(context.supabase as unknown as RpcClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const checks: HealthCheck[] = [];

    const db = await supabaseAdmin.from("civic_coverage").select("id").limit(1);
    checks.push(db.error
      ? { key: "db", label: "Database", status: "error", detail: `Database query failed: ${db.error.message}` }
      : { key: "db", label: "Database", status: "ok", detail: "Database is reachable and answering queries." });

    const ai = await supabaseAdmin.from("civic_ai_state").select("paused, reason, updated_at").eq("id", "classification").maybeSingle();
    checks.push(ai.error
      ? { key: "ai", label: "AI photo analysis", status: "warning", detail: "Could not read the AI service state." }
      : ai.data?.paused
        ? { key: "ai", label: "AI photo analysis", status: "warning", detail: ai.data.reason ?? "AI analysis is paused; reports go to staff classification." }
        : { key: "ai", label: "AI photo analysis", status: "ok", detail: "AI analysis is enabled. Last recorded state change: " + (ai.data?.updated_at ?? "never") + "." });

    const geoUrl = process.env["CIVICFIX_NOMINATIM_URL"];
    checks.push(geoUrl
      ? { key: "geo", label: "Address search (geocoding)", status: "ok", detail: "A hosted geocoding service is configured." }
      : { key: "geo", label: "Address search (geocoding)", status: "warning", detail: "No hosted geocoding service URL is configured (CIVICFIX_NOMINATIM_URL). Address search is limited; manual map-pin selection still works." });

    const failed = await supabaseAdmin.from("issue_notifications").select("id", { count: "exact", head: true }).eq("status", "failed");
    checks.push((failed.count ?? 0) > 0
      ? { key: "notif", label: "Notifications", status: "error", detail: `${failed.count} notification delivery failure(s) recorded.` }
      : { key: "notif", label: "Notifications", status: "ok", detail: "No failed notification deliveries recorded. External government channels remain not configured." });

    const unverified = await supabaseAdmin.from("civic_department_routes").select("id", { count: "exact", head: true }).neq("verification_status", "verified").eq("active", true);
    checks.push((unverified.count ?? 0) > 0
      ? { key: "routes", label: "Department routing", status: "warning", detail: `${unverified.count} active department route(s) are not yet verified against an official source.` }
      : { key: "routes", label: "Department routing", status: "ok", detail: "All active department routes are verified." });

    const teams = await supabaseAdmin.from("civic_teams").select("id, is_fallback").eq("active", true);
    const fallback = (teams.data ?? []).some((t) => t.is_fallback);
    checks.push(!teams.data?.length
      ? { key: "teams", label: "Operational teams", status: "warning", detail: "No active teams configured — new reports will land in the routing-exception queue." }
      : !fallback
        ? { key: "teams", label: "Operational teams", status: "warning", detail: `${teams.data.length} active team(s), but no fallback team. Unmatched reports go to the routing-exception queue.` }
        : { key: "teams", label: "Operational teams", status: "ok", detail: `${teams.data.length} active team(s) including a fallback.` });

    return checks;
  });
