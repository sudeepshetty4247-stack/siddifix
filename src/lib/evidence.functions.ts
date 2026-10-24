import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { evidenceInput, decodeEvidenceImage } from './evidence-validation';

export const recordEvidence = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof evidenceInput>) => evidenceInput.parse(input))
  .handler(async ({ data, context }) => {
    const staff = await context.supabase.rpc('is_staff', { _user_id: context.userId });
    if (staff.error || !staff.data) throw new Error('Staff access required.');
    const { bytes, mime, extension } = decodeEvidenceImage(data.imageDataUrl);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const path = `staff-evidence/${data.issueId}/${crypto.randomUUID()}.${extension}`;
    const uploaded = await supabaseAdmin.storage.from('issue-photos').upload(path, bytes, { contentType: `image/${mime}`, upsert: false });
    if (uploaded.error) throw new Error('Evidence upload failed. Please try again.');
    const saved = await context.supabase.rpc('staff_record_evidence', { _id: data.issueId, _kind: data.kind, _path: path, _note: data.note });
    if (saved.error) {
      await supabaseAdmin.storage.from('issue-photos').remove([path]);
      throw new Error(saved.error.message);
    }
    return { id: saved.data };
  });

// A deliberate public projection: no storage paths, staff IDs, or credentials.
export const getIssueEvidence = createServerFn({ method: 'GET' })
  .inputValidator((input: { issueId: string }) => z.object({ issueId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const result = await supabaseAdmin.from('issue_evidence').select('id,kind,note,recorded_at,storage_path').eq('issue_id', data.issueId).order('recorded_at');
    if (result.error) throw new Error('Evidence could not be loaded.');
    return Promise.all((result.data ?? []).map(async row => {
      const signed = await supabaseAdmin.storage.from('issue-photos').createSignedUrl(row.storage_path, 3600);
      return { id: row.id, kind: row.kind, note: row.note, recordedAt: row.recorded_at, photoUrl: signed.data?.signedUrl ?? null };
    }));
  });