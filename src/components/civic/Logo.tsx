import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-ink" />
      <path d="M16 6.5c-4.1 0-7.4 3.2-7.4 7.2 0 5.3 7.4 11.8 7.4 11.8s7.4-6.5 7.4-11.8c0-4-3.3-7.2-7.4-7.2Z" className="fill-primary" />
      <path d="m12.7 13.8 2.3 2.3 4.5-4.6" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="stroke-primary-foreground" />
    </svg>
  );
}

export function Logo({ to = "/", tone = "default" }: { to?: "/" | "/staff"; tone?: "default" | "inverse" }) {
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label="CivicFix home">
      <LogoMark />
      <span className={cn("font-display text-lg font-bold tracking-tight", tone === "inverse" ? "text-sidebar-accent-foreground" : "text-foreground")}>
        Civic<span className="text-primary">Fix</span>
      </span>
    </Link>
  );
}
