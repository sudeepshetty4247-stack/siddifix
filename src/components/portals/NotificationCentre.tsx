import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useNavigate, Link } from '@tanstack/react-router';
import { Bell, Search, RefreshCw, CheckCheck, Archive, Mail, MailOpen, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { getNotifications, changeNotification, type NotificationRow } from '@/lib/notifications.functions';
import { NOTIFICATION_TYPES, notificationLabel } from '@/lib/notification-policy';
import { cn } from '@/lib/utils';

export function useNotificationPage(filters: { state?: 'all' | 'read' | 'unread' | 'archived'; type?: string; priority?: '' | 'normal' | 'high' | 'critical'; search?: string; page?: number } = {}) {
  const read = useServerFn(getNotifications);
  return useQuery({ queryKey: ['recipient-notifications', filters], queryFn: () => read({ data: filters }), refetchInterval: 15000, refetchOnReconnect: 'always', retry: 1 });
}
function useNotificationActions() {
  const write = useServerFn(changeNotification);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function act(id: string | null, action: 'read' | 'unread' | 'archive' | 'restore' | 'read_all') {
    if (busy) return false;
    setBusy(true);
    try { await write({ data: { id, action } }); await qc.invalidateQueries({ queryKey: ['recipient-notifications'] }); return true; }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Notification was not saved.'); return false; }
    finally { setBusy(false); }
  }
  return { act, busy };
}
export function NotificationBell({ admin }: { admin: boolean }) {
  const [open, setOpen] = useState(false);
  const q = useNotificationPage({ state: 'unread' });
  const { act, busy } = useNotificationActions();
  const navigate = useNavigate();
  async function view(n: NotificationRow) {
    if (!await act(n.id, 'read')) return;
    setOpen(false);
    await navigate({ to: n.issue_id ? admin ? '/admin/issues/$id' : '/staff/issues/$id' : admin ? '/admin/notifications' : '/staff/notifications', params: n.issue_id ? { id: n.issue_id } : {} });
  }
  return <div className="relative"><Button variant="ghost" size="icon" aria-label={q.isError ? 'Notifications unavailable' : `Notifications, ${q.data?.unread ?? 0} unread`} aria-expanded={open} onClick={() => setOpen(!open)}><Bell className="h-5 w-5"/>{!!q.data?.unread && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1 text-xs text-primary-foreground">{q.data.unread > 99 ? '99+' : q.data.unread}</span>}</Button>
    {open && <section aria-label="Recent notifications" className="absolute right-0 z-50 mt-3 w-80 max-w-[85vw] rounded-lg border bg-card p-4 shadow-soft"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Notifications</h2><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Close</Button></div>{q.isPending && <p role="status" className="py-4 text-sm">Loading notifications…</p>}{q.isError && <p role="alert" className="py-4 text-sm">Notifications unavailable.<Button variant="ghost" size="sm" onClick={() => q.refetch()}>Retry</Button></p>}{q.data?.rows.slice(0, 5).map(n => <Button key={n.id} variant="ghost" disabled={busy} onClick={() => view(n)} className="my-1 h-auto w-full justify-start whitespace-normal py-3 text-left"><span><strong className="block text-sm">{n.title}</strong><span className="text-xs text-muted-foreground">{n.ref_code ?? 'Account'} · {new Date(n.created_at).toLocaleString('en-IN')}</span></span></Button>)}{q.data?.unread === 0 && <p className="py-5 text-sm text-muted-foreground">You’re all caught up.</p>}<Button asChild variant="outline" className="w-full"><Link to={admin ? '/admin/notifications' : '/staff/notifications'} onClick={() => setOpen(false)}>All notifications</Link></Button></section>}
  </div>;
}
export function NotificationCentre({ admin = false }: { admin?: boolean }) {
  const [state, setState] = useState<'all' | 'unread' | 'read' | 'archived'>('all');
  const [type, setType] = useState('');
  const [priority, setPriority] = useState<'' | 'normal' | 'high' | 'critical'>('');
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(0);
  const [offline, setOffline] = useState(false);
  useEffect(() => { const id = setTimeout(() => setTerm(search), 300); return () => clearTimeout(id); }, [search]);
  useEffect(() => setPage(0), [state, type, priority, term]);
  useEffect(() => { const update = () => setOffline(!navigator.onLine); update(); window.addEventListener('online', update); window.addEventListener('offline', update); return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); }; }, []);
  const q = useNotificationPage({ state, type, priority, search: term, page });
  const { act, busy } = useNotificationActions();
  const navigate = useNavigate();
  async function open(n: NotificationRow) { if (await act(n.id, 'read') && n.issue_id) await navigate({ to: admin ? '/admin/issues/$id' : '/staff/issues/$id', params: { id: n.issue_id } }); }
  return <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase text-primary">Your authorized updates</p><h1 className="mt-2 text-3xl font-bold">Notification centre</h1><p className="mt-2 text-sm text-muted-foreground">{q.data ? `${q.data.unread} unread` : 'Checking saved notifications…'}</p></div><div className="flex gap-2"><Button size="icon" variant="outline" aria-label="Refresh notifications" onClick={() => q.refetch()}><RefreshCw className="h-4 w-4"/></Button><Button variant="outline" disabled={busy || !q.data?.unread} onClick={() => act(null, 'read_all')}><CheckCheck className="h-4 w-4"/>Mark all read</Button></div></div>
    {(offline || q.isError) && <div role="alert" className="border-y py-4 text-sm text-warning-foreground">{offline ? 'Offline. Saved notifications will refresh when you reconnect.' : 'Notifications could not be refreshed. Nothing was changed.'}{q.dataUpdatedAt > 0 && <p>Last successful refresh: {new Date(q.dataUpdatedAt).toLocaleString('en-IN')}</p>}<Button variant="outline" size="sm" onClick={() => q.refetch()}>Retry</Button></div>}
    <div className="flex flex-wrap gap-2" role="group" aria-label="Notification state">{(['all', 'unread', 'read', 'archived'] as const).map(s => <Button key={s} size="sm" variant={s === state ? 'default' : 'outline'} aria-pressed={s === state} onClick={() => setState(s)}>{notificationLabel(s)}</Button>)}</div>
    <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input aria-label="Search notifications" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search message or case reference" className="pl-9"/></div><select aria-label="Notification type" className="h-10 rounded-md border bg-card px-3 text-sm" value={type} onChange={e => setType(e.target.value)}><option value="">All event types</option>{NOTIFICATION_TYPES.map(t => <option key={t} value={t}>{notificationLabel(t)}</option>)}</select><select aria-label="Notification priority" className="h-10 rounded-md border bg-card px-3 text-sm" value={priority} onChange={e => setPriority(e.target.value as typeof priority)}><option value="">Any priority</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></div>
    {q.isPending && <p role="status" className="py-10 text-center">Loading notifications…</p>}
    {q.data?.rows.length === 0 && <section className="border-y py-14 text-center"><Bell className="mx-auto mb-3 h-7 w-7 text-muted-foreground"/><h2 className="font-semibold">No notifications in this view</h2></section>}
    <div className="divide-y">{q.data?.rows.map(n => <article key={n.id} className={cn('py-5', !n.read_at && 'border-l-2 border-primary pl-4')}><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{notificationLabel(n.notification_type)} · {new Date(n.created_at).toLocaleString('en-IN')} · {n.priority}</p><h2 className="mt-2 font-semibold">{n.title}</h2><p className="mt-2 break-words text-sm">{n.detail}</p><p className="mt-2 text-xs text-muted-foreground">{n.ref_code ?? 'Account update'} · {n.channel === 'in_app' && n.status === 'posted' ? 'Saved in app' : n.status}</p></div><div className="flex flex-wrap gap-2">{n.issue_id && <Button size="sm" variant="outline" disabled={busy} onClick={() => open(n)}><ArrowUpRight className="h-4 w-4"/>Open case</Button>}<Button size="icon" variant="ghost" disabled={busy} aria-label={n.read_at ? 'Mark unread' : 'Mark read'} title={n.read_at ? 'Mark unread' : 'Mark read'} onClick={() => act(n.id, n.read_at ? 'unread' : 'read')}>{n.read_at ? <Mail className="h-4 w-4"/> : <MailOpen className="h-4 w-4"/>}</Button><Button size="icon" variant="ghost" disabled={busy} aria-label={n.archived_at ? 'Restore notification' : 'Archive notification'} title={n.archived_at ? 'Restore notification' : 'Archive notification'} onClick={() => act(n.id, n.archived_at ? 'restore' : 'archive')}><Archive className="h-4 w-4"/></Button></div></div></article>)}</div>
    <div className="flex items-center justify-between border-t pt-4"><Button variant="outline" size="sm" disabled={page === 0 || q.isFetching} onClick={() => setPage(page - 1)}>Previous</Button><p className="text-xs text-muted-foreground">Page {page + 1} · {q.data?.total ?? 0} notifications</p><Button variant="outline" size="sm" disabled={(page + 1) * 25 >= (q.data?.total ?? 0) || q.isFetching} onClick={() => setPage(page + 1)}>Next</Button></div>
  </main>;
}