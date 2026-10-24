import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listTeam, setRole, type TeamRole } from "@/lib/issues.functions";
import { listTeams, upsertTeam } from "@/lib/teams.functions";
import { createStaffAccount, setStaffSuspended, resetStaffAccess } from "@/lib/staff-accounts.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useRoles } from "./staff";
import { CATEGORIES, categoryById, timeAgo } from "@/lib/civic";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  head: () => ({ meta: [{ title: "Team access management — Siddi" }, { name: "description", content: "Manage authorized Siddi staff roles, designations and work areas." }, { property: "og:title", content: "Team access management — Siddi" }, { property: "og:description", content: "Manage authorized Siddi staff roles, designations and work areas." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Team,
});

const ROLES: { id: TeamRole; label: string; hint: string }[] = [
  { id: "field_worker", label: "Field team", hint: "Acknowledge, schedule, record progress and completion within their categories/wards" },
  { id: "supervisor", label: "Supervisor", hint: "Assign, reject, review duplicates and close cases" },
  { id: "admin", label: "Admin", hint: "Manage team, directory and routing" },
];

type Member = Awaited<ReturnType<typeof listTeam>>[number];

function Team() {
  const access = useRoles();
  const reset = useServerFn(resetStaffAccess);
  const list = useServerFn(listTeam);
  const set = useServerFn(setRole);
  const suspendFn = useServerFn(setStaffSuspended);
  const [adding, setAdding] = useState(false);
  async function toggleSuspend(u: Member) {
    const reason = window.prompt(u.suspended ? "Reason for reactivating this account" : "Reason for suspending this account (their case history is kept)");
    if (!reason || reason.trim().length < 3) return;
    try {
      const r = await suspendFn({ data: { userId: u.id, suspend: !u.suspended, reason } });
      if(r.authSyncPending)toast.warning("Database access updated; provider ban synchronization needs retry.");
      toast.success(u.suspended ? "Account reactivated" : `Account suspended${r.openCases ? ` — ${r.openCases} open case(s) need reassignment` : ""}`);
      qc.invalidateQueries({ queryKey: ["team"] });
    } catch (e) { toast.error((e as Error).message); }
  }
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
        <h1 className="text-3xl font-bold">Staff Management</h1>
        <p className="text-muted-foreground">Invitation-only access, authorized departments and audited account changes.</p>
      </div>
      <div className="flex justify-end"><button onClick={() => setAdding(!adding)} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">{adding ? "Close" : "Add staff account"}</button></div>
      {adding && <CreateStaffForm onDone={() => { setAdding(false); qc.invalidateQueries({ queryKey: ["team"] }); }} />}
      <div className="grid gap-3 sm:grid-cols-3">
        {ROLES.filter(r=>r.id!=="admin").map(r => <div key={r.id} className="rounded-xl border bg-card p-3 text-sm"><p className="font-semibold">{r.label}</p><p className="text-xs text-muted-foreground">{r.hint}</p></div>)}
      </div>
      {q.error && <p className="rounded-xl bg-destructive-soft p-4 text-sm text-destructive">{(q.error as Error).message}</p>}
      <div className="space-y-3">
        {(q.data ?? []).filter(u => !u.roles.includes("admin")).map((u) => (
          <div key={u.id} className="rounded-2xl border bg-card p-4 shadow-soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-semibold">{u.profile?.display_name || u.email}{u.suspended && <span className="ml-2 rounded-full bg-destructive-soft px-2 py-0.5 text-xs text-destructive">Suspended</span>}</p>
                <p className="text-xs text-muted-foreground">{u.email} · joined {timeAgo(u.createdAt)} · last sign-in {u.lastSignIn ? timeAgo(u.lastSignIn) : "never"}</p>
                {u.profile && <p className="mt-1 text-xs">{u.profile.designation}{u.profile.department ? ` · ${u.profile.department}` : ""}{u.profile.categories.length ? ` · ${u.profile.categories.join(", ")}` : " · no categories authorized"}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {ROLES.filter(r => r.id !== "admin").map(r => (
                  <label key={r.id} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${u.roles.includes(r.id) ? "border-primary bg-primary-soft text-primary" : ""}`}>
                    <input type="checkbox" checked={u.roles.includes(r.id)} onChange={(e) => toggle(u.id, r.id, e.target.checked)} className="h-3.5 w-3.5 accent-primary" />{r.label}
                  </label>
                ))}
                <button onClick={() => setEditing(editing === u.id ? null : u.id)} className="rounded-full border px-3 py-1 text-xs font-semibold hover:bg-secondary">{editing === u.id ? "Close" : "Profile"}</button>
                <Button variant="outline" size="sm" onClick={async () => { try { await reset({data:{userId:u.id}}); toast.success("Recovery email requested"); } catch(e) { toast.error((e as Error).message); } }}>Reset access</Button>
                <button onClick={() => toggleSuspend(u)} className="rounded-full border px-3 py-1 text-xs font-semibold hover:bg-secondary">{u.suspended ? "Reactivate" : "Suspend"}</button>
              </div>
            </div>
            {editing === u.id && <ProfileForm member={u} onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["team"] }); }} />}
          </div>
        ))}
        {q.isLoading && <p className="p-6 text-center text-sm text-muted-foreground">Loading team…</p>}
      </div>
      <TeamsSection members={q.data ?? []} />
    </div>
  );
}

type TeamRow = Awaited<ReturnType<typeof listTeams>>[number];

function TeamsSection({ members }: { members: Member[] }) {
  const list = useServerFn(listTeams);
  const save = useServerFn(upsertTeam);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["teams"], queryFn: () => list() });
  const [editing, setEditing] = useState<TeamRow | "new" | null>(null);
  const supervisors = members.filter((m) => m.roles.includes("supervisor") || m.roles.includes("admin"));

  async function submit(form: TeamFormState) {
    try {
      await save({
        data: {
          id: editing && editing !== "new" ? editing.id : null,
          name: form.name, department: form.department, categories: form.categories,
          wards: form.wards.split(",").map((w) => w.trim()).filter(Boolean),
          supervisorId: form.supervisorId || null,
          contactLabel: form.contactLabel || null, contactPhone: form.contactPhone || null,
          isFallback: form.isFallback, active: form.active, notes: form.notes,
        },
      });
      toast.success("Team saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["teams"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <section className="space-y-4 border-t pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Operational teams</h2>
          <p className="text-sm text-muted-foreground">New reports are routed to a team by category and ward. Teams with no ward list serve every ward; one fallback team catches anything unmatched.</p>
        </div>
        <button onClick={() => setEditing("new")} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">New team</button>
      </div>
      {q.error && <p className="rounded-xl bg-destructive-soft p-4 text-sm text-destructive">{(q.error as Error).message}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {(q.data ?? []).map((t) => (
          <div key={t.id} className={`rounded-2xl border bg-card p-4 shadow-soft ${t.active ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{t.name}{t.is_fallback ? " · fallback" : ""}{t.active ? "" : " · inactive"}</p>
                <p className="text-xs text-muted-foreground">{t.department}</p>
              </div>
              <button onClick={() => setEditing(t)} className="rounded-full border px-3 py-1 text-xs font-semibold hover:bg-secondary">Edit</button>
            </div>
            <p className="mt-2 text-xs">{t.categories.length ? t.categories.map((c) => categoryById(c)?.label ?? c).join(", ") : "All categories"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.wards.length ? `${t.wards.length} ward(s)` : "All wards"}{t.contact_label ? ` · ${t.contact_label}` : ""}{t.contact_phone ? ` ${t.contact_phone}` : ""}</p>
          </div>
        ))}
        {q.data?.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground sm:col-span-2">No teams yet. Create one so incoming reports can be routed automatically.</p>}
      </div>
      {editing && <TeamForm team={editing === "new" ? null : editing} supervisors={supervisors} onCancel={() => setEditing(null)} onSubmit={submit} />}
    </section>
  );
}

type TeamFormState = { name: string; department: string; categories: string[]; wards: string; supervisorId: string; contactLabel: string; contactPhone: string; isFallback: boolean; active: boolean; notes: string };

function TeamForm({ team, supervisors, onCancel, onSubmit }: { team: TeamRow | null; supervisors: Member[]; onCancel: () => void; onSubmit: (f: TeamFormState) => Promise<void> }) {
  const [name, setName] = useState(team?.name ?? "");
  const [department, setDepartment] = useState(team?.department ?? "");
  const [cats, setCats] = useState<string[]>(team?.categories ?? []);
  const [wards, setWards] = useState((team?.wards ?? []).join(", "));
  const [supervisorId, setSupervisorId] = useState(team?.supervisor_id ?? "");
  const [contactLabel, setContactLabel] = useState(team?.contact_label ?? "");
  const [contactPhone, setContactPhone] = useState(team?.contact_phone ?? "");
  const [isFallback, setIsFallback] = useState(team?.is_fallback ?? false);
  const [active, setActive] = useState(team?.active ?? true);
  const [notes, setNotes] = useState(team?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const field = "mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm";
  return (
    <div className="grid gap-3 rounded-2xl border bg-card p-4 shadow-soft sm:grid-cols-2">
      <label className="text-sm"><span className="text-muted-foreground">Team name</span><input value={name} maxLength={120} placeholder="e.g. Roads & Potholes — South" onChange={(e) => setName(e.target.value)} className={field} /></label>
      <label className="text-sm"><span className="text-muted-foreground">Department / service</span><input value={department} maxLength={160} placeholder="e.g. Road infrastructure" onChange={(e) => setDepartment(e.target.value)} className={field} /></label>
      <fieldset className="sm:col-span-2">
        <legend className="text-sm text-muted-foreground">Categories this team handles</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <label key={c.id} className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-xs ${cats.includes(c.id) ? "border-primary bg-primary-soft text-primary" : ""}`}>
              <input type="checkbox" className="sr-only" checked={cats.includes(c.id)} onChange={(e) => setCats(e.target.checked ? [...cats, c.id] : cats.filter((x) => x !== c.id))} />{c.emoji} {c.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="text-sm"><span className="text-muted-foreground">Ward identifiers (comma separated, empty = all wards)</span><input value={wards} onChange={(e) => setWards(e.target.value)} className={field} /></label>
      <label className="text-sm"><span className="text-muted-foreground">Responsible supervisor</span>
        <select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} className={field}>
          <option value="">None selected</option>
          {supervisors.map((m) => <option key={m.id} value={m.id}>{m.profile?.display_name || m.email}</option>)}
        </select>
      </label>
      <label className="text-sm"><span className="text-muted-foreground">Contact label (verified only)</span><input value={contactLabel} maxLength={120} placeholder="e.g. Team control room" onChange={(e) => setContactLabel(e.target.value)} className={field} /></label>
      <label className="text-sm"><span className="text-muted-foreground">Contact phone (verified only)</span><input value={contactPhone} maxLength={40} onChange={(e) => setContactPhone(e.target.value)} className={field} /></label>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={isFallback} onChange={(e) => setIsFallback(e.target.checked)} className="h-4 w-4 accent-primary" /> Fallback team (catches unmatched reports)</label>
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-primary" /> Active</label>
      </div>
      <label className="text-sm sm:col-span-2"><span className="text-muted-foreground">Notes</span><input value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} className={field} /></label>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancel</button>
        <button disabled={busy || name.trim().length < 3 || department.trim().length < 2} onClick={async () => { setBusy(true); await onSubmit({ name: name.trim(), department: department.trim(), categories: cats, wards, supervisorId, contactLabel: contactLabel.trim(), contactPhone: contactPhone.trim(), isFallback, active, notes: notes.trim() }); setBusy(false); }} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Save team</button>
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
  const list=useServerFn(listTeams);
  const teams=useQuery({queryKey:['teams'],queryFn:()=>list()});
  const [teamIds,setTeamIds]=useState<string[]>(p?.team_ids??[]);
  const [corporations,setCorporations]=useState((p?.corporations??[]).join(', '));

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_full_staff_scope", { _user: member.id, _name: name, _designation: designation, _department: department, _categories: cats, _wards: wards.split(",").map(w => w.trim()).filter(Boolean), _teams:teamIds, _corporations:corporations.split(",").map(c=>c.trim()).filter(Boolean) });
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
      <fieldset className="sm:col-span-3"><legend className="text-sm text-muted-foreground">Authorized teams</legend><div className="mt-2 flex flex-wrap gap-3">{(teams.data??[]).filter(t=>t.active&&t.department===department).map(t=><label key={t.id} className="text-sm"><input type="checkbox" checked={teamIds.includes(t.id)} onChange={e=>setTeamIds(e.target.checked?[...teamIds,t.id]:teamIds.filter(id=>id!==t.id))}/>{t.name}</label>)}</div></fieldset>
      <label className="text-sm sm:col-span-3">Corporation scope (exact configured names, comma separated)<input value={corporations} onChange={e=>setCorporations(e.target.value)} className={field}/></label>
      <fieldset className="sm:col-span-3">
        <legend className="text-sm text-muted-foreground">Authorized categories (none = no case access)</legend>
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

function CreateStaffForm({ onDone }: { onDone: () => void }) {
  const create = useServerFn(createStaffAccount);
  const [f, setF] = useState({ email: "", fullName: "", designation: "", department: "", role: "field_worker" as "field_worker" | "supervisor", wards: "", teamId: "", corporations: "" });
  const list = useServerFn(listTeams);
  const teams = useQuery({queryKey:["teams"],queryFn:()=>list()});
  const configured = (teams.data ?? []).filter(t => t.active);
  const departments = [...new Set(configured.map(t => t.department))];
  const [cats, setCats] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const field = "mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm";

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    setBusy(true);
    try {
      await create({ data: { ...f, categories: cats, wards: f.wards.split(",").map(w => w.trim()).filter(Boolean), teamIds: f.teamId ? [f.teamId] : [], corporations:f.corporations.split(",").map(c=>c.trim()).filter(Boolean) } });
      toast.success("Secure invitation sent. The staff member sets their own private password.");
      onDone();
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border bg-card p-4 shadow-soft sm:grid-cols-3">
      <h2 className="text-lg font-bold sm:col-span-3">New staff account</h2>
      <label className="text-sm"><span className="text-muted-foreground">Full name</span><input required value={f.fullName} onChange={set("fullName")} className={field} /></label>
      <label className="text-sm"><span className="text-muted-foreground">Work email</span><input required type="email" value={f.email} onChange={set("email")} className={field} /></label>
      <label className="text-sm"><span className="text-muted-foreground">Role</span><select value={f.role} onChange={set("role")} className={field}><option value="field_worker">Field team</option><option value="supervisor">Supervisor</option></select></label>
      <label className="text-sm"><span className="text-muted-foreground">Designation</span><input required value={f.designation} onChange={set("designation")} className={field} /></label>
      <label className="text-sm"><span className="text-muted-foreground">Department</span><select required value={f.department} onChange={set("department")} className={field}><option value="">Select configured department</option>{departments.map(d=><option key={d}>{d}</option>)}</select></label>
      <label className="text-sm"><span className="text-muted-foreground">Authorized team</span><select value={f.teamId} onChange={set("teamId")} className={field}><option value="">Department scope</option>{configured.filter(t=>t.department===f.department).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <fieldset className="sm:col-span-3"><legend className="text-sm text-muted-foreground">Authorized categories</legend><div className="mt-2 flex flex-wrap gap-2">{CATEGORIES.filter(c=>configured.some(t=>t.department===f.department && t.categories.includes(c.id))).map(c => (<label key={c.id} className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-xs ${cats.includes(c.id) ? "border-primary bg-primary-soft text-primary" : ""}`}><input type="checkbox" className="sr-only" checked={cats.includes(c.id)} onChange={e => setCats(e.target.checked ? [...cats, c.id] : cats.filter(x => x !== c.id))} />{c.emoji} {c.label}</label>))}</div></fieldset>
      <label className="text-sm sm:col-span-2"><span className="text-muted-foreground">Ward identifiers (comma separated, empty = all)</span><input value={f.wards} onChange={set("wards")} className={field} /></label>
      <label className="text-sm sm:col-span-2">Corporation scope (exact configured names, comma separated)<input value={f.corporations} onChange={set("corporations")} className={field}/></label>
      <div className="flex items-end justify-end"><button disabled={busy} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Creating…" : "Send invitation"}</button></div>
    </form>
  );
}
