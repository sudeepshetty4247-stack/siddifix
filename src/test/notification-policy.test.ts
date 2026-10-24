import { describe, it, expect } from 'vitest';
import { notificationAction, notificationFilters } from '@/lib/notification-policy';
describe('Notification request boundaries', () => {
  it('requires a valid notification for individual state changes', () => expect(notificationAction.safeParse({ id: null, action: 'read' }).success).toBe(false));
  it('does not accept a target ID for mark all', () => expect(notificationAction.safeParse({ id: '11111111-1111-4111-8111-111111111111', action: 'read_all' }).success).toBe(false));
  it('supports marking all without an ID', () => expect(notificationAction.parse({ id: null, action: 'read_all' }).action).toBe('read_all'));
  it('rejects negative pagination', () => expect(notificationFilters.safeParse({ page: -1 }).success).toBe(false));
  it('rejects unbounded search strings', () => expect(notificationFilters.safeParse({ search: 'x'.repeat(121) }).success).toBe(false));
  it('supports read, unread, archive and restore states', () => {
    for (const action of ['read', 'unread', 'archive', 'restore']) expect(notificationAction.safeParse({ id: '11111111-1111-4111-8111-111111111111', action }).success).toBe(true);
  });
});