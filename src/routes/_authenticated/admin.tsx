import { createFileRoute } from '@tanstack/react-router';
import { PortalShell } from '@/components/portals/PortalShell';
export const Route=createFileRoute('/_authenticated/admin')({component:()=> <PortalShell portal="admin"/>});
