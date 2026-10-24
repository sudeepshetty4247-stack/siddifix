import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getDirectory } from "./directory.functions";
import { resolveCivicRouting } from "./directory";
import { CATEGORIES, SEVERITY_META, categoryById, isInIndia, isInBengaluru, type Severity } from "./civic";
import { reportInputSchema } from './report-input';
import { validateImageContainer } from './image-format';
import { TRACKING_TOKEN_RE, CASE_REF_RE } from './tracking-token';
import { incidentCoverage } from './incident-coverage';

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
    const {consumeRequest}=await import('./civic-security.server');await consumeRequest('analysis',15);
    const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
    const { analyzeIssueWithAI, fallbackAnalysis, AiError } = await import("./ai.server");
    const state=await supabaseAdmin.from('civic_ai_state').select('paused,reason').eq('id','classification').maybeSingle();
    if(state.data?.paused)return {ok:false as const,source:'fallback' as const,analysis:fallbackAnalysis(data.description),notice:state.data.reason??'AI analysis is paused; staff can classify your report.'};
    try {
      const analysis = await analyzeIssueWithAI(data);
      return { ok: true as const, source: "ai" as const, analysis };
    } catch (e) {
      const status = e instanceof AiError ? e.status : 500;
      if([401,402,403,404].includes(status))await supabaseAdmin.from('civic_ai_state').upsert({id:'classification',paused:true,reason:'AI analysis is paused pending service configuration or access recovery. Reports remain available for staff classification.',updated_at:new Date().toISOString()});
      console.error("AI analysis failed", status, (e as Error).message);
      const notice =
        status === 402 || status === 403
          ? "AI analysis is paused right now. You can submit for staff classification."
          : status === 429
            ? "AI is busy. We pre-filled a basic guess — please check it."
            : "AI couldn't analyse this photo. You can submit for staff classification.";
      return { ok: false as const, source: "fallback" as const, analysis: fallbackAnalysis(data.description), notice };
    }
  });

// ---------- Submit (public, idempotent) ----------
const submitSchema = reportInputSchema;

export const submitIssue = createServerFn({ method: "POST" })
  .inputValidator((input: z.input<typeof submitSchema>) => submitSchema.parse(input))
  .handler(async ({ data }) => {
    const {consumeRequest}=await import('./civic-security.server');await consumeRequest('submit',10);
    if (!isInIndia(data.lat, data.lng)) throw new Error("CivicFix currently accepts locations within India only.");
    const incidentCheck=incidentCoverage(await getDirectory(),data.lat,data.lng);
    if(incidentCheck.status!=='supported')throw new Error(incidentCheck.status==='unknown'?"We couldn't verify this location yet. Confirm a point inside a single supported ward.":"Siddi currently accepts reports only inside its configured Bengaluru service area. Change the incident location.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Idempotency: repeated taps / retries return the original report.
    const existing = await supabaseAdmin
      .from("issues")
      .select("id, ref_code")
      .eq("idempotency_key", data.idempotencyKey)
      .maybeSingle();
    if (existing.error) throw new Error("We couldn't verify this submission. Please try again.");
    if (existing.data) return { ref: existing.data.ref_code, token: null, duplicate: true };

    let originalHash:string|null=null;
    if(data.originalPath){
      if(!data.originalPath.startsWith(`originals/${data.idempotencyKey}/`) || !data.photoMetadata)throw new Error('Original photo does not match this report.');
      const original=await supabaseAdmin.storage.from('issue-photos').download(data.originalPath);
      if(original.error||!original.data||original.data.size>25*1024*1024)throw new Error('Original photo could not be verified.');
      const bytes=new Uint8Array(await original.data.arrayBuffer());
      const extension=data.originalPath.split('.').at(-1) ?? '';
      validateImageContainer(bytes,extension);
      originalHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    }

    // Upload photo
    const match = data.imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    const mime = match?.[1], b64 = match?.[2];
    if (!mime || !b64) throw new Error('Invalid image.');
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    if (bin.length > 5500000) throw new Error('The processed image is too large.');
    validateImageContainer(bin,mime);
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
    const routing = resolveCivicRouting(await getDirectory(), data.lat, data.lng, data.category, data.subcategory ?? undefined);
    const { coverageFromWardMatches, canAcceptReport } = await import('./coverage');
    const coverage = coverageFromWardMatches(routing.ward ? 1 : routing.reviewReason?.startsWith('This pin touches') ? 2 : 0);
    if (!routing.coverage || !canAcceptReport(coverage)) {
      await supabaseAdmin.storage.from('issue-photos').remove([path]);
      throw new Error("This location is outside Siddi's current service area. Siddi accepts reports inside Bengaluru's wards only.");
    }
    const targetRows = await supabaseAdmin.from('service_targets').select('category,severity,ack_hours,resolve_hours,version,active').eq('active', true);
    const { computeTargets } = await import('./service-targets');
    const targets = computeTargets((targetRows.data ?? []) as never, data.category, severity, new Date());
    const refCode = `BLR-${randomString(6)}`;
    const token = randomToken();

    const { data: result, error } = await supabaseAdmin.rpc('create_civic_report', {
      _token: token,
      _report: {
        ref_code: refCode, idempotency_key: data.idempotencyKey, title: data.title,
        summary: data.summary ?? null, description: data.description ?? null,
        category: data.category, subcategory: data.subcategory ?? null, severity,
        status: data.needsClassification ? 'needs_classification' : 'submitted',
        ai_confidence: data.aiConfidence ?? null, safety_warning: data.safetyWarning ?? null,
        lat: data.lat, lng: data.lng, landmark: data.landmark ?? null, photo_url: signed.data.signedUrl,
        department: null, duplicate_of: data.duplicateOf ?? null,
        sla_due_at: targets.resolveDueAt, ack_due_at:targets.ackDueAt, target_snapshot:JSON.parse(JSON.stringify(targets.snapshot)),
        routing_snapshot: JSON.parse(JSON.stringify({...routing,incident_location:{original_address:data.incidentLocation?.originalAddress??data.landmark??null,normalized_address:data.incidentLocation?.normalizedAddress??null,source:data.incidentLocation?.source??'map',verification:'supported',checked_at:new Date().toISOString()}})),
        original_path:data.originalPath??null,display_path:path,original_sha256:originalHash,
        photo_source:data.photoMetadata?.source??'gallery',photo_metadata:data.photoMetadata ? JSON.parse(JSON.stringify(data.photoMetadata)) : null,
      },
    });
    if (error) {
      await supabaseAdmin.storage.from('issue-photos').remove([path]);
      console.error('Report transaction failed', error.code, error.message);
      throw new Error("We couldn't save your report. Please try again.");
    }
    const saved = result as { ref: string; duplicate: boolean };
    if (saved.duplicate) await supabaseAdmin.storage.from('issue-photos').remove([path]);
    return { ref: saved.ref, token: saved.duplicate ? null : token, duplicate: saved.duplicate };
  });

// ---------- Citizen actions with private recovery token ----------
export const citizenAction = createServerFn({ method: "POST" })
  .inputValidator((input: { ref: string; token: string; action: "reopen" | "confirm"; note?: string }) =>
    z
      .object({ ref: z.string().regex(CASE_REF_RE), token: z.string().regex(TRACKING_TOKEN_RE), action: z.enum(["reopen", "confirm"]), note: z.string().max(500).optional() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const {consumeRequest}=await import('./civic-security.server');await consumeRequest('reporter-action',20);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.rpc('citizen_change_issue', { _ref: data.ref, _token: data.token, _action: data.action, _note: data.note ?? '' });
    if (result.error) throw new Error(result.error.message);
    return { status: result.data };
  });

export const verifyToken = createServerFn({ method: "POST" })
  .inputValidator((input: { ref: string; token: string }) => z.object({ ref: z.string().regex(CASE_REF_RE), token: z.string().regex(TRACKING_TOKEN_RE) }).parse(input))
  .handler(async ({ data }) => {
    const {consumeRequest}=await import('./civic-security.server');await consumeRequest('tracking-verify',30);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result=await supabaseAdmin.rpc('verify_reporter_token',{_ref:data.ref,_token:data.token});
    return {valid:!result.error&&result.data===true};
  });

// ---------- Staff / admin ----------
export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const active = await context.supabase.rpc('account_active', { _user: context.userId });
    const { data } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    return { roles: active.data ? (data ?? []).map(r => r.role) : [], userId: context.userId, email: String(context.claims.email ?? '') };
  });

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Only admins can manage the team.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const users = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const roles = await supabaseAdmin.from("user_roles").select("user_id, role");
    const profiles = await supabaseAdmin.from("staff_profiles").select("*");
    return (users.data?.users ?? []).map((u) => ({
      profile: (profiles.data ?? []).find((p) => p.user_id === u.id) ?? null,
      id: u.id,
      email: u.email ?? "",
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at ?? null,
      suspended: (profiles.data ?? []).find(p => p.user_id === u.id)?.active === false,
      roles: (roles.data ?? []).filter((r) => r.user_id === u.id).map((r) => r.role),
    }));
  });

export type TeamRole = "admin" | "staff" | "supervisor" | "field_worker";

export const setRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: TeamRole; grant: boolean }) =>
    z.object({ userId: z.string().uuid(), role: z.enum(["admin", "staff", "supervisor", "field_worker"]), grant: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc('admin_change_role', { _user: data.userId, _role: data.role, _grant: data.grant });
    if (r.error) throw new Error(r.error.message);
    return { ok: true };
  });
