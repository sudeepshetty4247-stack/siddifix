import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { notificationAction, notificationFilters } from './notification-policy';
import type { z } from 'zod';

export type NotificationRow = {
  id: string; issue_id: string | null; ref_code: string | null; notification_type: string;
  title: string; detail: string; priority: string; created_at: string; channel: string;
  status: string; read_at: string | null; archived_at: string | null;
};
export type NotificationPage = { unread: number; total: number; rows: NotificationRow[] };
export const getNotifications = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof notificationFilters>) => notificationFilters.parse(input))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc('notification_page', { _state: data.state, _type: data.type, _priority: data.priority, _search: data.search, _page: data.page });
    if (r.error) throw new Error('Notifications could not be loaded.');
    return r.data as unknown as NotificationPage;
  });
export const changeNotification = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof notificationAction>) => notificationAction.parse(input))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc('set_notification_state', { _action: data.action, ...data.id ? { _id: data.id } : {} });
    if (r.error) throw new Error('Notification state was not saved. Please retry.');
    return { changed: r.data };
  });