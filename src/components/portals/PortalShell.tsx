import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { LayoutDashboard, ListTodo, Users, ShieldCheck, Bell, Timer, Repeat, Map, Menu, LogOut, ExternalLink, Settings2 } from 'lucide-react';
import { Logo } from '@/components/civic/Logo';
import { BackButton } from '@/components/civic/BackButton';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getPortalAccess } from '@/lib/portal.functions';
import { NotificationBell } from './NotificationCentre';
import { canEnterPortal } from '@/lib/portal-access';

export function usePortalAccess() {
  const fn = useServerFn(getPortalAccess);
  return useQuery({ queryKey: ['portal-access'], queryFn: () => fn(), staleTime: 0, refetchInterval: 15000, retry: false });
}
export function PortalShell({ portal }: { portal: 'admin' | 'staff' }) {
  const access = usePortalAccess();
  const pathname=useRouterState({select:s=>s.location.pathname});
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open,setOpen] = useState(false);
  const admin = portal === 'admin';
  async function signOut() { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); await navigate({ to: admin ? '/admin-login' : '/staff-login', replace: true }); }
  if (access.isPending) return <p className="p-8" role="status">Verifying secure access…</p>;
  if (!access.data || !canEnterPortal(access.data,portal)) return <main className="flex min-h-screen items-center justify-center bg-background p-6"><div className="max-w-md space-y-4"><ShieldCheck className="h-10 w-10 text-primary"/><h1 className="text-2xl font-bold">{access.data?.active === false ? 'Account inactive' : 'This portal is restricted'}</h1><p className="text-muted-foreground">{access.data?.active === false ? 'Your access has been suspended. Contact your administrator.' : 'Your account does not have permission to enter this portal.'}</p>{access.data?.active && <Button asChild><Link to={access.data.roles.includes('admin') ? '/admin' : '/staff'}>Open my portal</Link></Button>}<Button variant="outline" onClick={signOut}>Sign out</Button><Link to="/" className="block text-sm text-primary">Citizen site</Link></div></main>;
  const nav = admin ? [
    { to: '/admin', label: 'Control centre', icon: LayoutDashboard }, { to: '/admin/reports', label: 'Reports & operations', icon: ListTodo }, { to: '/admin/staff', label: 'Staff management', icon: Users }, { to: '/admin/administrators', label: 'Administrator access', icon: ShieldCheck }, { to: '/admin/directory', label: 'Departments & authority data', icon: Settings2 }, { to: '/admin/responses', label: 'Response configuration', icon: Settings2 }, { to: '/admin/targets', label: 'Service targets', icon: Timer }, { to: '/admin/feedback', label: 'Citizen feedback', icon: Bell }, { to: '/admin/routing', label: 'Routing exceptions', icon: ListTodo }, { to: '/admin/insights', label: 'Duplicates & recurring', icon: Repeat }, { to: '/admin/overdue', label: 'Overdue & escalated', icon: Timer }, { to: '/admin/notifications', label: 'Notifications', icon: Bell }, { to: '/admin/audit', label: 'Audit & system health', icon: ShieldCheck },
  ] as const : [
    { to: '/staff', label: 'My workload', icon: LayoutDashboard }, { to: '/staff/queue', label: 'Department queue', icon: ListTodo }, { to: '/staff/overdue', label: 'Overdue & escalated', icon: Timer }, { to: '/staff/insights', label: 'Duplicates & recurring', icon: Repeat }, { to: '/staff/map', label: 'Case map', icon: Map }, { to: '/staff/notifications', label: 'Notifications', icon: Bell },
  ] as const;
  const sidebar = <div className="flex h-full flex-col gap-6 p-5"><Logo to={admin ? '/admin' : '/staff'} tone="inverse"/><p className="text-xs font-semibold uppercase text-sidebar-primary">{admin ? 'Admin Control Centre' : 'Government Staff Portal'}</p><nav className="flex flex-col gap-1">{nav.map(n => <Link key={n.to} to={n.to} activeOptions={{exact:true}} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent" activeProps={{className:'bg-sidebar-accent text-sidebar-accent-foreground'}}><n.icon className="h-4 w-4 shrink-0"/>{n.label}</Link>)}</nav><div className="mt-auto space-y-3 border-t border-sidebar-border pt-4"><p className="break-all text-xs text-sidebar-foreground">{access.data.email}</p><p className="text-xs text-sidebar-primary">{admin ? access.data.isSuperAdmin ? 'Super Admin' : 'Administrator' : access.data.profile?.department || 'Scope pending'}</p><Button variant="ghost" className="text-sidebar-foreground" onClick={signOut}><LogOut className="h-4 w-4"/>Sign out</Button><Link to="/" className="flex items-center gap-2 text-xs text-sidebar-foreground"><ExternalLink className="h-3 w-3"/>Citizen site</Link></div></div>;
  return <div className="flex min-h-screen bg-background"><aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto bg-sidebar lg:block">{sidebar}</aside>{open && <div className="fixed inset-0 z-[1200] flex lg:hidden"><aside className="h-full w-72 overflow-y-auto bg-sidebar">{sidebar}</aside><Button variant="ghost" className="flex-1 bg-ink/50" aria-label="Close menu" onClick={() => setOpen(false)}/></div>}<div className="min-w-0 flex-1"><header className="flex items-center justify-between gap-4 border-b bg-card px-4 py-3"><div className="flex items-center gap-3"><Button size="icon" variant="ghost" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5"/></Button><BackButton fallback={admin ? '/admin' : '/staff'}/><span className="text-sm font-semibold">{admin ? 'Administration' : 'Government operations'}</span></div><div className="flex items-center gap-3"><NotificationBell admin={admin}/><span className="hidden text-xs text-muted-foreground sm:inline">{admin ? 'Authorized management' : 'Authorized scope only'}</span></div></header>{!admin && !access.data.configured && pathname!=="/staff/notifications" ? <section className="mx-auto max-w-xl space-y-4 px-6 py-16"><h1 className="text-2xl font-bold">Your work scope needs configuration</h1><p className="text-muted-foreground">Your account is active, but no active team matches your assigned department and categories. Ask the administrator who invited you to configure your team and jurisdiction.</p><p className="text-sm">Department: {access.data.profile?.department||"Not assigned"}</p><Button variant="outline" onClick={()=>access.refetch()}>Check again</Button></section> : <Outlet/>}</div></div>;
}
