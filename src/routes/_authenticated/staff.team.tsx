import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listTeam, setRole, type TeamRole } from "@/lib/issues.functions";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, timeAgo } from "@/lib/civic";

export const Route = createFileRoute("/_authenticated/staff/team")({
  head: () => ({ meta: [{ title: "Team access management — CivicFix" }, { name: "description", content: "Manage authorized CivicFix staff roles, designations and work areas." }, { property: "og:title", content: "Team access management — CivicFix" }, { property: "og:description", content: "Manage authorized CivicFix staff roles, designations and work areas." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Team,
});

const ROLES: { id: TeamRole; label: string; hint: string }[] = [
  { id: "field_worker", label: "Field team", hint: "Acknowledge, schedule, record progress and completion within their categories/wards" },
  { id: "supervisor", label: "Supervisor", hint: "Assign, reject, review duplicates and close cases" },
  { id: "admin", label: "Admin", hint: "Manage team, directory and routing" },
];

type Member = Awaited<ReturnType<typeof listTeam>>[number];

function Team() {
  const list = useServerFn(listTeam);
  const set = useServerFn(setRole);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["team"], queryFn: () => list() });
  const [editing, setEditing] = useState<string | null>(null);

  async function toggle(userId: string, role: TeamRole, grant: boolean) {
    try {
      await set({ data: { userId, role, grant } });
      toast.success(grant ? "Access granted" : "Access removed");
      qc.invalidateQueries({ queryKey: ["team"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <div>
        <h1 className="text-3xl font-bold">Team Management</h1>
        <p className="text-muted-foreground">People who signed in at the staff page appear here. Signing up never grants access — you decide each role.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {ROLES.map(r => <div key={r.id} className="rounded-xl border bg-card p-3 text-sm"><p className="font-semibold">{r.label}</p><p className="text-xs text-muted-foreground">{r.hint}</p></div>)}
      </div>
      {q.error && <p className="rounded-xl bg-destructive-soft p-4 text-sm text-destructive">{(q.error as Error).message}</p>}
      <div className="space-y-3">
        {(q.data ?? []).map((u) => (
          <div key={u.id} className="rounded-2xl border bg-card p-4 shadow-soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-semibold">{u.profile?.display_name || u.email}</p>
                <p className="text-xs text-muted-foreground">{u.email} · joined {timeAgo(u.createdAt)} · last sign-in {u.lastSignIn ? timeAgo(u.lastSignIn) : "never"}</p>
                {u.profile && <p className="mt-1 text-xs">{u.profile.designation}{u.profile.department ? ` · ${u.profile.department}` : ""}{u.profile.categories.length ? ` · ${u.profile.categories.join(", ")}` : " · all categories"}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {ROLES.map(r => (
                  <label key={r.id} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${u.roles.includes(r.id) ? "border-primary bg-primary-soft text-primary" : ""}`}>
                    <input type="checkbox" checked={u.roles.includes(r.id)} onChange={(e) => toggle(u.id, r.id, e.target.checked)} className="h-3.5 w-3.5 accent-primary" />{r.label}
                  </label>
                ))}
                <button onClick={() => setEditing(editing === u.id ? null : u.id)} className="rounded-full border px-3 py-1 text-xs font-semibold hover:bg-secondary">{editing === u.id ? "Close" : "Profile"}</button>
              </div>
            </div>
            {editing === u.id && <ProfileForm member={u} onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["team"] }); }} />}
          </div>
        ))}
        {q.isLoading && <p className="p-6 text-center text-sm text-muted-foreground">Loading team…</p>}
      </div>
    </div>
  );
}

function ProfileForm({ member, onSaved }: { member: Member; onSaved: () => void }) {
  const p = member.profile;
  const [name, setName] = useState(p?.display_name ?? "");
  const [designation, setDesignation] = useState(p?.designation ?? "");
  const [department, setDepartment] = useState(p?.department ?? "");
  const [cats, setCats] = useState<string[]>(p?.categories ?? []);
  const [wards, setWards] = useState((p?.wards ?? []).join(", "));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_staff_profile", { _user: member.id, _name: name, _designation: designation, _department: department, _categories: cats, _wards: wards.split(",").map(w => w.trim()).filter(Boolean) });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile saved");
    onSaved();
  }
  const field = "mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm";
  return (
    <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-3">
      <label className="text-sm"><span className="text-muted-foreground">Name shown to citizens</span><input value={name} maxLength={120} onChange={e => setName(e.target.value)} className={field} /></label>
      <label className="text-sm"><span className="text-muted-foreground">Designation</span><input value={designation} maxLength={120} placeholder="e.g. Assistant Engineer" onChange={e => setDesignation(e.target.value)} className={field} /></label>
      <label className="text-sm"><span className="text-muted-foreground">Department / team</span><input value={department} maxLength={160} placeholder="e.g. Roads maintenance" onChange={e => setDepartment(e.target.value)} className={field} /></label>
      <fieldset className="sm:col-span-3">
        <legend className="text-sm text-muted-foreground">Categories this person works on (none = all)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORIES.map(c => (
            <label key={c.id} className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-xs ${cats.includes(c.id) ? "border-primary bg-primary-soft text-primary" : ""}`}>
              <input type="checkbox" className="sr-only" checked={cats.includes(c.id)} onChange={e => setCats(e.target.checked ? [...cats, c.id] : cats.filter(x => x !== c.id))} />{c.emoji} {c.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="text-sm sm:col-span-2"><span className="text-muted-foreground">Ward identifiers (comma separated, empty = all)</span><input value={wards} onChange={e => setWards(e.target.value)} className={field} /></label>
      <div className="flex items-end justify-end"><button disabled={busy} onClick={save} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">Save profile</button></div>
    </div>
  );
}
