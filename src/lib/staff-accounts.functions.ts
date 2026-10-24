import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Admin-only staff account lifecycle. Every handler re-checks the admin role in the
// database before touching the privileged client; nothing here trusts the UI.

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Only administrators can manage staff accounts.");
}

export const staffPasswordRule = (pw: string) =>
  pw.length >= 12 && /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw);

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  fullName: z.string().trim().min(2).max(120),
  designation: z.string().trim().min(2).max(120),
  department: z.string().trim().min(2).max(160),
  role: z.enum(["field_worker", "supervisor", "admin"]),
  categories: z.array(z.string().max(60)).max(30),
  wards: z.array(z.string().max(60)).max(400),
  tempPassword: z.string().min(12).max(128).refine(staffPasswordRule, "Use 12+ characters with upper, lower case and a number."),
});

export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof createSchema>) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.tempPassword,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (created.error || !created.data.user) {
      const msg = created.error?.message ?? "Could not create account";
      throw new Error(/already/i.test(msg) ? "An account with this email already exists." : msg);
    }
    const uid = created.data.user.id;
    const roleRes = await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    const profRes = await supabaseAdmin.from("staff_profiles").upsert({
      user_id: uid, display_name: data.fullName, designation: data.designation,
      department: data.department, categories: data.categories, wards: data.wards,
    });
    if (roleRes.error || profRes.error) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      throw new Error("Account setup failed and was rolled back.");
    }
    await supabaseAdmin.from("civic_directory_audit").insert({
      table_name: "staff_accounts", record_id: uid, action: "create",
      new_row: { email: data.email, role: data.role, department: data.department, categories: data.categories, wards: data.wards },
      actor_id: context.userId,
    });
    return { id: uid };
  });

export const setStaffSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; suspend: boolean; reason: string }) =>
    z.object({ userId: z.string().uuid(), suspend: z.boolean(), reason: z.string().trim().min(3).max(300) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("You can't suspend your own account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.suspend ? "876000h" : "none",
    });
    if (res.error) throw new Error(res.error.message);
    await supabaseAdmin.from("civic_directory_audit").insert({
      table_name: "staff_accounts", record_id: data.userId,
      action: data.suspend ? "suspend" : "reactivate",
      new_row: { reason: data.reason }, actor_id: context.userId,
    });
    // Count open cases that may need reassignment (history is preserved, never deleted).
    const open = await supabaseAdmin.from("issues").select("id", { count: "exact", head: true })
      .eq("assigned_to", data.userId).not("status", "in", "(resolved,closed,rejected)");
    return { ok: true, openCases: open.count ?? 0 };
  });
