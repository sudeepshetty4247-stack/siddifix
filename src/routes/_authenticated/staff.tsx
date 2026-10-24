import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { LayoutDashboard, ListTodo, Map, Users, LogOut, ExternalLink, Clock, Menu, X, Bell, ShieldCheck } from "lucide-react";
import { getMyRoles } from "@/lib/issues.functions";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/civic/Logo";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/civic/BackButton";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({ meta: [{ title: "Staff workspace — Siddi" }, { name: "description", content: "Review real civic reports, assignments, evidence and resolution history." }, { property: "og:title", content: "Staff workspace — Siddi" }, { property: "og:description", content: "Authenticated civic issue resolution workspace." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: StaffLayout,
});

export function useRoles() {
  const fn = useServerFn(getMyRoles);
  return useQuery({ queryKey: ["my-roles"], queryFn: () => fn(), staleTime: 60_000 });
}

function StaffLayout() {
  const roles = useRoles();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (roles.isLoading) return <div className="flex min-h-screen items-center justify-center bg-sidebar"><div className="h-8 w-8 animate-spin rounded-full border-2 border-sidebar-primary border-t-transparent" /></div>;

  const r = roles.data?.roles ?? [];
  const isAdmin = r.includes("admin");
  const r2 = r as string[];
  const roleLabel = isAdmin ? "Administrator" : r2.includes("supervisor") || r2.includes("staff") ? "Supervisor" : "Field team";
  if (!isAdmin && !r2.some(x => ["staff", "supervisor", "field_worker"].includes(x))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background bg-civic-grid p-6">
        <div className="max-w-md rounded-3xl border bg-card p-8 text-center shadow-lift">
          <Clock className="mx-auto h-10 w-10 text-warning" />
          <h1 className="mt-4 text-2xl font-bold">Access pending</h1>
          <p className="mt-2 text-sm text-muted-foreground">You're signed in as <strong>{roles.data?.email}</strong>, but an administrator hasn't granted you staff access yet. Ask them to add you from Team Management.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Link to="/" className="inline-flex h-10 items-center rounded-lg border px-4 text-sm font-semibold">Citizen site</Link>
            <button onClick={signOut} className="inline-flex h-10 items-center rounded-lg bg-ink px-4 text-sm font-semibold text-ink-foreground">Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  const nav = [
    { to: "/staff" as const, label: "Overview", icon: LayoutDashboard, exact: true },
    { to: "/staff/queue" as const, label: "Issue Queue", icon: ListTodo },
    { to: "/staff/routing" as const, label: "Routing Exceptions", icon: ListTodo },
    { to: "/staff/overdue" as const, label: "Overdue & Escalated", icon: Clock },
    { to: "/staff/map" as const, label: "Map & Hotspots", icon: Map },
    { to: "/staff/notifications" as const, label: "Notifications", icon: Bell },
    ...(isAdmin ? [{ to: "/staff/directory" as const, label: "Routing Setup", icon: ListTodo }] : []),
    ...(isAdmin ? [{ to: "/staff/team" as const, label: "Team Management", icon: Users }] : []),
    ...(isAdmin ? [{ to: "/staff/audit" as const, label: "Audit & Health", icon: ShieldCheck }] : []),
  ];

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="px-2 pt-2"><Logo to="/staff" tone="inverse" /></div>
      <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">Workspace</p>
      <nav className="-mt-4 flex flex-col gap-1">
        {nav.map((n) => (
          <Link key={n.to} to={n.to} onClick={() => setOpen(false)} activeOptions={{ exact: !!n.exact }} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition hover:bg-sidebar-accent" activeProps={{ className: "bg-sidebar-accent !text-sidebar-accent-foreground" }}>
            <n.icon className="h-4 w-4" />{n.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto space-y-1">
        <Link to="/transparency" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent"><ExternalLink className="h-4 w-4" />Public transparency</Link>
        <Link to="/assistant" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent"><ExternalLink className="h-4 w-4" />Ask Siddi</Link>
        <Link to="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent"><ExternalLink className="h-4 w-4" /> Citizen site</Link>
        <div className="rounded-xl border border-sidebar-border p-3">
          <p className="truncate text-sm font-medium text-sidebar-accent-foreground">{roles.data?.email}</p>
          <p className="text-xs capitalize text-sidebar-primary">{roleLabel}</p>
          <button onClick={signOut} className="mt-2 flex items-center gap-2 text-xs text-sidebar-foreground hover:text-sidebar-accent-foreground"><LogOut className="h-3.5 w-3.5" /> Sign out</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 bg-sidebar lg:block">{sidebar}</aside>
      <div className={cn("fixed inset-0 z-[1100] lg:hidden", open ? "block" : "hidden")}>
        <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
        <aside className="relative h-full w-64 bg-sidebar">{sidebar}</aside>
      </div>
      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-[1000] flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Menu">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          <Logo to="/staff" />
        </div>
        <div className="border-b px-4 py-2"><BackButton fallback="/staff" /></div>
        <Outlet />
      </div>
    </div>
  );
}
