import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listTeam, setRole } from "@/lib/issues.functions";
import { timeAgo } from "@/lib/civic";

export const Route = createFileRoute("/_authenticated/staff/team")({
  component: Team,
});

function Team() {
  const list = useServerFn(listTeam);
  const set = useServerFn(setRole);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["team"], queryFn: () => list() });

  async function toggle(userId: string, role: "admin" | "staff", grant: boolean) {
    try {
      await set({ data: { userId, role, grant } });
      toast.success(grant ? `Granted ${role}` : `Removed ${role}`);
      qc.invalidateQueries({ queryKey: ["team"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <div>
        <h1 className="text-3xl font-bold">Team Management</h1>
        <p className="text-muted-foreground">People who signed up at the staff sign-in page appear here. Grant access to let them work on issues.</p>
      </div>
      {q.error && <p className="rounded-xl bg-destructive-soft p-4 text-sm text-destructive">{(q.error as Error).message}</p>}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="p-3">Account</th><th className="p-3">Last sign-in</th><th className="p-3 text-center">Staff</th><th className="p-3 text-center">Admin</th></tr>
          </thead>
          <tbody className="divide-y">
            {(q.data ?? []).map((u) => (
              <tr key={u.id}>
                <td className="p-3"><p className="font-medium">{u.email}</p><p className="text-xs text-muted-foreground">Joined {timeAgo(u.createdAt)}</p></td>
                <td className="p-3 text-muted-foreground">{u.lastSignIn ? timeAgo(u.lastSignIn) : "Never"}</td>
                {(["staff", "admin"] as const).map((r) => (
                  <td key={r} className="p-3 text-center">
                    <input type="checkbox" checked={u.roles.includes(r)} onChange={(e) => toggle(u.id, r, e.target.checked)} className="h-4 w-4 accent-primary" aria-label={`${r} access for ${u.email}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {q.isLoading && <p className="p-6 text-center text-sm text-muted-foreground">Loading team…</p>}
      </div>
    </div>
  );
}
