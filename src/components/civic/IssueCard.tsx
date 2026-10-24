import { Link } from "@tanstack/react-router";
import { MapPin, Users, Clock } from "lucide-react";
import { categoryById, isOverdue, timeAgo } from "@/lib/civic";
import { StatusBadge, SeverityTag } from "./StatusBadge";

export type IssueRow = {
  id: string;
  ref_code: string;
  title: string;
  summary: string | null;
  category: string;
  severity: string;
  status: string;
  photo_url: string | null;
  landmark: string | null;
  support_count: number;
  sla_due_at: string | null;
  created_at: string;
  lat: number;
  lng: number;
};

export function IssueCard({ issue }: { issue: IssueRow }) {
  const cat = categoryById(issue.category);
  const overdue = isOverdue(issue);
  return (
    <Link
      to="/issues/$ref"
      params={{ ref: issue.ref_code }}
      className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {issue.photo_url ? (
          <img src={issue.photo_url} alt={issue.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl">{cat.emoji}</div>
        )}
        <div className="absolute left-3 top-3"><StatusBadge status={issue.status} className="bg-card/95 backdrop-blur" /></div>
        {overdue && <span className="absolute right-3 top-3 rounded-full bg-warning px-2 py-0.5 text-xs font-semibold text-warning-foreground">Overdue</span>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{cat.emoji} {cat.label}</span>
          <span className="font-mono">{issue.ref_code}</span>
        </div>
        <h3 className="line-clamp-2 text-base font-semibold leading-snug">{issue.title}</h3>
        {issue.landmark && <p className="flex items-center gap-1 truncate text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" />{issue.landmark}</p>}
        <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
          <SeverityTag severity={issue.severity} />
          <span className="flex items-center gap-3">
            {issue.support_count > 0 && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{issue.support_count + 1}</span>}
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{timeAgo(issue.created_at)}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export const ISSUE_COLUMNS = "id, ref_code, title, summary, category, severity, status, photo_url, landmark, support_count, sla_due_at, created_at, lat, lng";
