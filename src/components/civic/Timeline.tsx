import { STATUS_META, type IssueStatus } from "@/lib/civic";
import { cn } from "@/lib/utils";

export type EventRow = { id: string; kind: string; from_status: string | null; to_status: string | null; note: string | null; actor_label: string | null; created_at: string };

const kindLabel: Record<string, string> = {
  created: "Report submitted",
  status_change: "Status updated",
  assigned: "Ownership assigned",
  note: "Update posted",
  linked_report: "Matching report linked",
  disputed: "Closure disputed",
  citizen_confirmed: "Fix confirmed by reporter",
  escalated: "Escalated",
};

export function Timeline({ events }: { events: EventRow[] }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">No activity recorded yet.</p>;
  return (
    <ol className="relative space-y-6 border-l border-border pl-6">
      {events.map((e, i) => (
        <li key={e.id} className="relative">
          <span className={cn("absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-background", i === events.length - 1 ? "bg-primary ring-4 ring-primary/15" : "bg-muted-foreground/40")} />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="font-medium">
              {kindLabel[e.kind] ?? e.kind}
              {e.to_status && e.kind !== "created" && <span className="text-muted-foreground"> → {STATUS_META[e.to_status as IssueStatus]?.label}</span>}
            </p>
            <time className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</time>
          </div>
          {e.note && <p className="mt-1 text-sm text-muted-foreground">{e.note}</p>}
          {e.actor_label && <p className="mt-1 text-xs text-muted-foreground/80">by {e.actor_label}</p>}
        </li>
      ))}
    </ol>
  );
}
