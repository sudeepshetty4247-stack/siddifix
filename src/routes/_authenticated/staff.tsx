import { createFileRoute } from '@tanstack/react-router';
import { PortalShell, usePortalAccess } from '@/components/portals/PortalShell';
export const useRoles = usePortalAccess;
export const Route = createFileRoute('/_authenticated/staff')({ component: () => <PortalShell portal="staff"/> });
