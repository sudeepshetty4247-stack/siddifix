import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CATEGORIES, SEVERITY_META, categoryById, isInIndia, isInBengaluru, type Severity } from "./civic";

const MAX_IMAGE_CHARS = 7_500_000; // ~5.5MB binary
const dataUrlRe = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;

function randomString(len: number, alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789") {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- AI analysis (public) ----------
export const analyzeIssue = createServerFn({ method: "POST" })
  .inputValidator((input: { imageDataUrl?: string | null; description?: string | null }) =>
    z
      .object({
        imageDataUrl: z.string().max(MAX_IMAGE_CHARS).regex(dataUrlRe).nullable().optional(),
        description: z.string().max(1000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { analyzeIssueWithAI, fallbackAnalysis, AiError } = await import("./ai.server");
    try {
      const analysis = await analyzeIssueWithAI(data);
      return { ok: true as const, source: "ai" as const, analysis };
    } catch (e) {
      const status = e instanceof AiError ? e.status : 500;
      console.error("AI analysis failed", status, (e as Error).message);
      const notice =
        status === 402 || status === 403
          ? "AI analysis is paused right now. Please choose the category yourself."
          : status === 429
            ? "AI is busy. We pre-filled a basic guess — please check it."
            : "AI couldn't analyse this photo. Please choose the category yourself.";
      return { ok: false as const, source: "fallback" as const, analysis: fallbackAnalysis(data.description), notice };
    }
  });

// ---------- Submit (public, idempotent) ----------
const submitSchema = z.object({
  idempotencyKey: z.string().uuid(),
  imageDataUrl: z.string().max(MAX_IMAGE_CHARS).regex(dataUrlRe),
  description: z.string().max(1000).nullable().optional(),
  title: z.string().trim().min(3).max(120),
  summary: z.string().max(600).nullable().optional(),
  category: z.enum(CATEGORIES.map((c) => c.id) as [string, ...string[]]),
  subcategory: z.string().max(80).nullable().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  aiConfidence: z.number().min(0).max(1).nullable().optional(),
  safetyWarning: z.string().max(300).nullable().optional(),
  needsClassification: z.boolean(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  landmark: z.string().max(200).nullable().optional(),
  duplicateOf: z.string().uuid().nullable().optional(),
});

export const submitIssue = createServerFn({ method: "POST" })
  .inputValidator((input: z.input<typeof submitSchema>) => submitSchema.parse(input))
  .handler(async ({ data }) => {
    if (!isInIndia(data.lat, data.lng)) throw new Error("CivicFix currently accepts locations within India only.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Idempotency: repeated taps / retries return the original report.
    const existing = await supabaseAdmin
      .from("issues")
      .select("id, ref_code, issue_secrets(recovery_token)")
      .eq("idempotency_key", data.idempotencyKey)
      .maybeSingle();
    if (existing.data) {
      const sec = existing.data.issue_secrets as unknown as { recovery_token: string } | null;
      return { ref: existing.data.ref_code, token: sec?.recovery_token ?? null, duplicate: true };
    }

    // Upload photo
    const [, mime, b64] = data.imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/)!;
    const bin = Uint8Array.from(atob(b64!), (c) => c.charCodeAt(0));
    const ext = mime === "png" ? "png" : mime === "webp" ? "webp" : "jpg";
    const path = `reports/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
    const up = await supabaseAdmin.storage.from("issue-photos").upload(path, bin, {
      contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
      upsert: false,
    });
    if (up.error) throw new Error("Photo upload failed. Please try again.");
    const signed = await supabaseAdmin.storage.from("issue-photos").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    if (signed.error) throw new Error("Photo upload failed. Please try again.");

    const severity = data.severity as Severity;
    const cat = categoryById(data.category);
    const refCode = `${isInBengaluru(data.lat, data.lng) ? "BLR" : "IND"}-${randomString(6)}`;
    const token = randomToken();

    const ins = await supabaseAdmin
      .from("issues")
      .insert({
        ref_code: refCode,
        idempotency_key: data.idempotencyKey,
        title: data.title,
        summary: data.summary ?? null,
        description: data.description ?? null,
        category: data.category,
        subcategory: data.subcategory ?? null,
        severity,
        status: data.needsClassification ? "needs_classification" : "submitted",
        ai_confidence: data.aiConfidence ?? null,
        safety_warning: data.safetyWarning ?? null,
        lat: data.lat,
        lng: data.lng,
        landmark: data.landmark ?? null,
        photo_url: signed.data.signedUrl,
        department: isInBengaluru(data.lat, data.lng) ? cat.authority : "Unverified area – authority not configured",
        duplicate_of: data.duplicateOf ?? null,
        sla_due_at: new Date(Date.now() + SEVERITY_META[severity].slaHours * 3600_000).toISOString(),
      })
      .select("id")
      .single();
    if (ins.error) {
      if (ins.error.code === "23505") {
        const again = await supabaseAdmin.from("issues").select("ref_code").eq("idempotency_key", data.idempotencyKey).maybeSingle();
        if (again.data) return { ref: again.data.ref_code, token: null, duplicate: true };
      }
      console.error(ins.error);
      throw new Error("We couldn't save your report. Nothing was submitted — please try again.");
    }

    await supabaseAdmin.from("issue_secrets").insert({ issue_id: ins.data.id, recovery_token: token });
    await supabaseAdmin.from("issue_events").insert([
      { issue_id: ins.data.id, kind: "created", to_status: data.needsClassification ? "needs_classification" : "submitted", actor_label: "Citizen", note: "Report submitted" },
      ...(data.duplicateOf
        ? [{ issue_id: data.duplicateOf, kind: "linked_report", actor_label: "Citizen", note: `Another citizen reported the same problem (${refCode})` }]
        : []),
    ]);
    if (data.duplicateOf) {
      const parent = await supabaseAdmin.from("issues").select("support_count").eq("id", data.duplicateOf).maybeSingle();
      if (parent.data) await supabaseAdmin.from("issues").update({ support_count: parent.data.support_count + 1 }).eq("id", data.duplicateOf);
    }
    return { ref: refCode, token, duplicate: false };
  });

// ---------- Citizen actions with private recovery token ----------
export const citizenAction = createServerFn({ method: "POST" })
  .inputValidator((input: { ref: string; token: string; action: "reopen" | "confirm"; note?: string }) =>
    z
      .object({ ref: z.string().max(20), token: z.string().length(48), action: z.enum(["reopen", "confirm"]), note: z.string().max(500).optional() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const issue = await supabaseAdmin.from("issues").select("id, status, issue_secrets(recovery_token)").eq("ref_code", data.ref).maybeSingle();
    const sec = issue.data?.issue_secrets as unknown as { recovery_token: string } | null;
    if (!issue.data || sec?.recovery_token !== data.token) throw new Error("This tracking link is not valid.");
    if (issue.data.status !== "resolved") throw new Error("This action is only available after an issue is marked resolved.");
    const to = data.action === "reopen" ? "reopened" : "closed";
    await supabaseAdmin.from("issues").update({ status: to }).eq("id", issue.data.id);
    await supabaseAdmin.from("issue_events").insert({
      issue_id: issue.data.id,
      kind: data.action === "reopen" ? "disputed" : "citizen_confirmed",
      from_status: "resolved",
      to_status: to,
      actor_label: "Original reporter",
      note: data.note || (data.action === "reopen" ? "Reporter says the problem is not fixed" : "Reporter confirmed the fix"),
    });
    return { status: to };
  });

export const verifyToken = createServerFn({ method: "POST" })
  .inputValidator((input: { ref: string; token: string }) => z.object({ ref: z.string().max(20), token: z.string().max(64) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const issue = await supabaseAdmin.from("issues").select("issue_secrets(recovery_token)").eq("ref_code", data.ref).maybeSingle();
    const sec = issue.data?.issue_secrets as unknown as { recovery_token: string } | null;
    return { valid: !!sec && sec.recovery_token === data.token };
  });

// ---------- Staff / admin ----------
export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    return { roles: (data ?? []).map((r) => r.role), userId: context.userId, email: (context.claims as { email?: string }).email ?? null };
  });

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Only admins can manage the team.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const users = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const roles = await supabaseAdmin.from("user_roles").select("user_id, role");
    return (users.data?.users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? "",
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at ?? null,
      roles: (roles.data ?? []).filter((r) => r.user_id === u.id).map((r) => r.role),
    }));
  });

export const setRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: "admin" | "staff"; grant: boolean }) =>
    z.object({ userId: z.string().uuid(), role: z.enum(["admin", "staff"]), grant: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Only admins can manage the team.");
    if (!data.grant && data.role === "admin" && data.userId === context.userId) throw new Error("You can't remove your own admin access.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) await supabaseAdmin.from("user_roles").upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    else await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role);
    return { ok: true };
  });
