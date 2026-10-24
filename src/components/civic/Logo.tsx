import { Link } from "@tanstack/react-router";

export function Logo({ to = "/", tone = "default" }: { to?: "/" | "/staff"; tone?: "default" | "inverse" }) {
  return (
    <Link to={to} className="flex shrink-0 flex-col" aria-label="Siddi home — Your City. Your Voice.">
      <span className={`font-display text-2xl font-bold ${tone === 'inverse' ? 'text-sidebar-accent-foreground' : 'text-foreground'}`}>Siddi</span>
      <span className={`text-[10px] font-medium ${tone === 'inverse' ? 'text-sidebar-primary' : 'text-primary'}`}>Your City. Your Voice.</span>
    </Link>
  );
}
