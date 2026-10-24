import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Scheduled job: escalate cases whose promised completion date (eta_at) has passed.
// Idempotent — escalate_overdue_issues() only touches cases not already escalated.
export const Route = createFileRoute("/api/public/jobs/escalate-overdue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const reminders=await supabaseAdmin.rpc('process_deadline_reminders');
        if(reminders.error)return Response.json({success:false},{status:500});
        const result = await supabaseAdmin.rpc("escalate_overdue_issues");
        if (result.error) {
          console.error("Overdue escalation job failed", result.error.message);
          return Response.json({ success: false }, { status: 500 });
        }
        return Response.json({ success: true, escalated: result.data ?? 0, reminders:reminders.data??0 });
      },
    },
  },
});
