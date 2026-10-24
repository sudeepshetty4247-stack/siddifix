import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Operational teams (category + ward routing) ----------

export const listTeams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("civic_teams")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const admin=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
    if(admin.data)return data??[];
    const p=await context.supabase.from('staff_profiles').select('department,team_ids').eq('user_id',context.userId).maybeSingle();
    return (data??[]).filter(t=>t.active&&t.department===p.data?.department&&(!p.data.team_ids.length||p.data.team_ids.includes(t.id)));
  });

const teamSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(3).max(120),
  department: z.string().trim().min(2).max(160),
  categories: z.array(z.string().max(60)).max(30),
  wards: z.array(z.string().max(60)).max(400),
  supervisorId: z.string().uuid().nullable(),
  contactLabel: z.string().max(120).nullable(),
  contactPhone: z.string().max(40).nullable(),
  isFallback: z.boolean(),
  active: z.boolean(),
  notes: z.string().max(500),
});

export const upsertTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof teamSchema>) => teamSchema.parse(input))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc("admin_upsert_team", {
      _id: data.id as string,
      _name: data.name,
      _department: data.department,
      _categories: data.categories,
      _wards: data.wards,
      _supervisor: data.supervisorId as string,
      _contact_label: data.contactLabel ?? "",
      _contact_phone: data.contactPhone ?? "",
      _fallback: data.isFallback,
      _active: data.active,
      _notes: data.notes,
    });
    if (result.error) throw new Error(result.error.message);
    return { id: result.data };
  });

export const listRoutingExceptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: staff } = await context.supabase.rpc("is_supervisor", { _user_id: context.userId });
    if (!staff) throw new Error("Staff access required");
    const { data, error } = await context.supabase
      .from("issues")
      .select("id, ref_code, title, category, severity, status, created_at, landmark, routing_snapshot")
      .eq("assignment_state", "routing_exception")
      .is("duplicate_of", null)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const assignTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { issueId: string; teamId: string; reason: string }) =>
    z.object({ issueId: z.string().uuid(), teamId: z.string().uuid(), reason: z.string().trim().min(3).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc("staff_assign_team", {
      _issue: data.issueId,
      _team: data.teamId,
      _reason: data.reason,
    });
    if (result.error) throw new Error(result.error.message);
    return { ok: true as const };
  });
