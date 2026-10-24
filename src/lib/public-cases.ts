import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { EventRow } from '@/components/civic/Timeline';

export type PublicCase = Pick<Database['public']['Tables']['issues']['Row'], 'id'|'ref_code'|'title'|'summary'|'description'|'category'|'subcategory'|'severity'|'status'|'safety_warning'|'lat'|'lng'|'landmark'|'photo_url'|'department'|'support_count'|'sla_due_at'|'resolved_at'|'created_at'|'updated_at'|'duplicate_of'|'duplicate_candidate_id'|'routing_snapshot'>;
export async function publicCases(ref?: string): Promise<PublicCase[]> {
  const result = await supabase.rpc('public_case_rows', {_ref:ref ?? undefined});
  if(result.error) throw result.error;
  return result.data as unknown as PublicCase[];
}
export async function publicEvents(id: string): Promise<EventRow[]> {
  const result = await supabase.rpc('public_case_events',{_id:id});
  if(result.error) throw result.error;
  return result.data as unknown as EventRow[];
}