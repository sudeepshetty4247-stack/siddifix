import type { Json } from '@/integrations/supabase/types';
export type ServiceArea = { id: string; name: string; settings: Json; reporting_enabled: boolean; notice: string; source_url: string | null; bounds: Json };
export type AreaSettings = { state_id?: string; state_name?: string; district_id?: string; district_name?: string; scope?: string; default_language?: string; boundary_verified?: boolean; center?: { lat: number; lng: number } };
export function areaSettings(area: ServiceArea | null | undefined): AreaSettings { return (area?.settings ?? {}) as AreaSettings; }
export function areaCenter(area: ServiceArea | null | undefined) { return areaSettings(area).center ?? { lat: 12.9716, lng: 77.5946 }; }
export function preferredAreaLanguage(explicit: string | null, suggestion?: string) { return explicit ?? (suggestion === 'te' ? 'te' : suggestion === 'kn' ? 'kn' : 'en'); }