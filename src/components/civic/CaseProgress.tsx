import { CalendarCheck, CalendarClock, Check, MessageSquareQuote, Search } from "lucide-react";
import { JOURNEY, journeyStep } from "@/lib/civic";
import { cn } from "@/lib/utils";

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

/** Five-step journey line: Reported → Assigned → Acknowledged → Work underway → Fixed. */
export function JourneyBar({ status }: { status: string }) {
  const at = journeyStep(status);
  const stopped = status === "rejected";
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Case progress">
      {JOURNEY.map((j, i) => {
        const done = !stopped && i <= at;
        return (
          <li key={j.key} className="space-y-2">
            <div className={cn("h-1.5 rounded-full", done ? (i === JOURNEY.length - 1 ? "bg-success" : "bg-primary") : "bg-muted")} />
            <p className={cn("flex items-center gap-1 text-[11px] font-semibold leading-tight sm:text-xs", done ? "text-foreground" : "text-muted-foreground")} aria-current={i === at ? "step" : undefined}>
              {done && i < at && <Check className="h-3 w-3 shrink-0 text-primary" />}{j.label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

type Ack = { acknowledged_at: string | null; ack_message: string | null; eta_at: string | null; inspection_at: string | null; acknowledged_by_label: string | null; status: string };

/** What the responsible team has told the citizen — or an honest "waiting" state. */
export function StaffResponse({ c }: { c: Ack }) {
  const open = !["resolved", "closed", "rejected"].includes(c.status);
  if (!c.acknowledged_at) {
    return (
      <section className="rounded-2xl border border-dashed bg-card p-5">
        <p className="text-sm font-semibold">Waiting for the team to acknowledge</p>
        <p className="mt-1 text-sm text-muted-foreground">Your report is saved in the Siddi staff queue. When a team member acknowledges it, their response and an estimated completion date will appear here.</p>
      </section>
    );
  }
  const etaLate = open && !!c.eta_at && new Date(c.eta_at).getTime() < Date.now();
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-soft">
      <div className="flex items-start gap-3 border-b bg-primary-soft p-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><MessageSquareQuote className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">Response from the team</p>
          <p className="mt-0.5 font-semibold">{c.acknowledged_by_label ?? "Siddi staff"}</p>
          <p className="text-xs text-muted-foreground">Acknowledged {fmt(c.acknowledged_at)}</p>
        </div>
      </div>
      {c.ack_message && <blockquote className="px-5 pt-4 text-[15px] leading-relaxed">“{c.ack_message}”</blockquote>}
      <div className="grid gap-3 p-5 sm:grid-cols-2">
        {c.inspection_at && (
          <div className="flex gap-3 rounded-xl bg-secondary p-3">
            <Search className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div><p className="text-xs text-muted-foreground">Inspection</p><p className="font-semibold">{day(c.inspection_at)}</p></div>
          </div>
        )}
        <div className={cn("flex gap-3 rounded-xl p-3", etaLate ? "bg-warning-soft" : "bg-secondary")}>
          {etaLate ? <CalendarClock className="mt-0.5 h-4 w-4 text-warning-foreground" /> : <CalendarCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />}
          <div>
            <p className="text-xs text-muted-foreground">Estimated completion</p>
            <p className="font-semibold">{c.eta_at ? day(c.eta_at) : "Not given yet"}</p>
            {etaLate && <p className="text-xs text-warning-foreground">This estimate has passed and the work isn’t marked done yet.</p>}
          </div>
        </div>
      </div>
      <p className="px-5 pb-4 text-xs text-muted-foreground">An estimate is the team’s forecast, not a guarantee. You’ll see every change here.</p>
    </section>
  );
}
