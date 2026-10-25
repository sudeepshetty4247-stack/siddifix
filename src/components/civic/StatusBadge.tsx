import { STATUS_META, SEVERITY_META, type IssueStatus, type Severity } from "@/lib/civic";
import { cn } from "@/lib/utils";
import {useI18n,type LocaleKey} from '@/lib/i18n';

const tones = {
  neutral: "bg-secondary text-secondary-foreground border-border",
  info: "bg-accent text-accent-foreground border-primary/20",
  progress: "bg-primary-soft text-primary border-primary/30",
  success: "bg-success-soft text-success border-success/30",
  warning: "bg-warning-soft text-warning-foreground border-warning/40",
  danger: "bg-destructive-soft text-destructive border-destructive/30",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const {tx,lang}=useI18n();
  const keys:Record<string,LocaleKey>={submitted:'submitted',assigned:'assigned',in_progress:'inProgress',under_review:'underReview',resolved:'resolved',closed:'closed',rejected:'rejected',reopened:'reopened',awaiting_verification:'awaitingVerification',needs_classification:'needsClassification',accepted:'accepted',inspection_scheduled:'inspectionScheduled'};
  const meta = STATUS_META[status as IssueStatus] ?? STATUS_META.submitted;
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium", tones[meta.tone], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {lang==='te'?tx(keys[status]??'submitted'):meta.label}
    </span>
  );
}

const sevTones: Record<Severity, string> = {
  low: "text-muted-foreground",
  medium: "text-foreground",
  high: "text-warning-foreground",
  critical: "text-destructive",
};
export function SeverityTag({ severity }: { severity: string }) {
  const s = (severity in SEVERITY_META ? severity : "medium") as Severity;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide", sevTones[s])}>
      <span className="flex gap-0.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-2.5 w-1 rounded-sm", i <= ["low", "medium", "high", "critical"].indexOf(s) ? "bg-current" : "bg-border")} />
        ))}
      </span>
      {SEVERITY_META[s].label}
    </span>
  );
}
