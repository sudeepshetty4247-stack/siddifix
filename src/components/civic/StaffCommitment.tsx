import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BellRing, CalendarClock, Handshake, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ACKNOWLEDGEABLE, type IssueStatus } from "@/lib/civic";

type Issue = { id: string; status: string; category: string; acknowledged_at: string | null; ack_message: string | null; eta_at: string | null; inspection_at: string | null; duplicate_of: string | null };

const toIso = (local: string) => (local ? new Date(local).toISOString() : null);
const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const minLocal = () => { const d = new Date(Date.now() + 5 * 60000); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

const TEMPLATES: Record<string, string> = {
  roads: "We have acknowledged this road report. Our team will inspect the site and schedule the repair.",
  waste: "We have acknowledged this waste report. A collection crew will be sent to clear the spot.",
  electricity: "We have acknowledged this streetlight/electrical report. A maintenance crew will inspect it.",
  drainage: "We have acknowledged this drainage report. Our team will inspect and clear the blockage.",
  water: "We have acknowledged this water supply report. Our team will inspect the leak.",
};

/** Acknowledge + promise a date, change the estimate, and see what was actually notified. */
export function StaffCommitment({ issue, onDone }: { issue: Issue; onDone: () => void }) {
  const canAck = !issue.duplicate_of && ACKNOWLEDGEABLE.includes(issue.status as IssueStatus);
  const open = !["resolved", "closed", "rejected"].includes(issue.status);
  const [msg, setMsg] = useState(TEMPLATES[issue.category] ?? "We have acknowledged this report and will inspect the site.");
  const [inspection, setInspection] = useState("");
  const [eta, setEta] = useState("");
  const [newEta, setNewEta] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const notes = useQuery({
    queryKey: ["staff-notifications", issue.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("issue_notifications").select("*").eq("issue_id", issue.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function acknowledge() {
    if (msg.trim().length < 10) { toast.error("Write a short response for the citizen (10+ characters)."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("staff_acknowledge_issue", { _id: issue.id, _expected: issue.status as IssueStatus, _message: msg.trim(), _eta: toIso(eta) as string, _inspection: toIso(inspection) as string });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Acknowledged — the citizen can see your response now.");
    onDone(); notes.refetch();
  }

  async function changeEta() {
    if (!newEta || reason.trim().length < 5) { toast.error("Pick a new date and give a reason."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("staff_update_eta", { _id: issue.id, _eta: toIso(newEta) as string, _reason: reason.trim() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Estimate updated and shown to the citizen.");
    setNewEta(""); setReason(""); onDone(); notes.refetch();
  }

  const field = "mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm";
  return (
    <div className="space-y-6">
      {canAck && (
        <div className="rounded-2xl border-2 border-primary/40 bg-card p-5 shadow-soft">
          <h2 className="flex items-center gap-2 font-semibold"><Handshake className="h-4 w-4 text-primary" /> Acknowledge & give a date</h2>
          <p className="mt-1 text-sm text-muted-foreground">Your response, name and designation appear on the citizen's tracking page immediately.</p>
          <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={3} maxLength={1000} aria-label="Response to the citizen" className="mt-4 w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm"><span className="text-muted-foreground">Inspection (optional)</span><input type="datetime-local" min={minLocal()} value={inspection} onChange={e => setInspection(e.target.value)} className={field} /></label>
            <label className="text-sm"><span className="text-muted-foreground">Estimated completion</span><input type="datetime-local" min={minLocal()} value={eta} onChange={e => setEta(e.target.value)} className={field} /></label>
          </div>
          <div className="mt-4 flex justify-end">
            <button disabled={busy} onClick={acknowledge} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Acknowledge report</button>
          </div>
        </div>
      )}

      {issue.acknowledged_at && (
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="flex items-center gap-2 font-semibold"><CalendarClock className="h-4 w-4" /> Commitment</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Acknowledged</dt><dd className="font-medium">{fmt(issue.acknowledged_at)}</dd></div>
            <div><dt className="text-muted-foreground">Inspection</dt><dd className="font-medium">{issue.inspection_at ? fmt(issue.inspection_at) : "—"}</dd></div>
            <div><dt className="text-muted-foreground">Estimated completion</dt><dd className={`font-medium ${open && issue.eta_at && new Date(issue.eta_at) < new Date() ? "text-destructive" : ""}`}>{issue.eta_at ? fmt(issue.eta_at) : "Not set"}{open && issue.eta_at && new Date(issue.eta_at) < new Date() ? " · overdue" : ""}</dd></div>
          </dl>
          {issue.ack_message && <p className="mt-3 border-l-2 pl-3 text-sm italic text-muted-foreground">“{issue.ack_message}”</p>}
          {open && (
            <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
              <label className="text-sm"><span className="text-muted-foreground">{issue.eta_at ? "New estimate" : "Set estimate"}</span><input type="datetime-local" min={minLocal()} value={newEta} onChange={e => setNewEta(e.target.value)} className={field} /></label>
              <label className="text-sm"><span className="text-muted-foreground">Reason (shown to citizen)</span><input value={reason} maxLength={500} onChange={e => setReason(e.target.value)} placeholder="e.g. Material delivery delayed" className={field} /></label>
              <button disabled={busy} onClick={changeEta} className="h-10 rounded-lg border px-4 text-sm font-semibold hover:bg-secondary disabled:opacity-50">Save</button>
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border bg-card p-5 shadow-soft">
        <h2 className="flex items-center gap-2 font-semibold"><BellRing className="h-4 w-4" /> Notifications</h2>
        <p className="mt-1 text-xs text-muted-foreground">Only what actually happened is recorded. No external government channel is connected yet.</p>
        <ul className="mt-3 divide-y text-sm">
          {(notes.data ?? []).map(n => (
            <li key={n.id} className="flex items-start justify-between gap-3 py-2.5">
              <div><p className="font-medium capitalize">{n.audience} · {n.channel === "in_app" ? "in-app" : n.channel}</p><p className="text-xs text-muted-foreground">{n.detail}</p></div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${n.status === "not_configured" || n.status === "failed" ? "bg-warning-soft text-warning-foreground" : "bg-success-soft text-success"}`}>{n.status === "not_configured" ? "Not configured" : n.status === "posted" ? "Shown in app" : n.status}</span>
            </li>
          ))}
          {notes.data && !notes.data.length && <li className="py-2.5 text-muted-foreground">Nothing recorded yet.</li>}
        </ul>
      </div>
    </div>
  );
}
