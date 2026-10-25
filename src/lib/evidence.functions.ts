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
    const scope = await context.supabase.rpc('staff_can_work', { _user_id: context.userId, _issue: data.issueId });
    if (!scope.data) throw new Error('This case is outside your authorized scope.');
    const { bytes, mime, extension } = decodeEvidenceImage(data.imageDataUrl);
    const {validateReportImage}=await import('./report-image.server');validateReportImage(bytes,mime,5500000);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const request=data.requestId??crypto.randomUUID();
    const existing=await context.supabase.from('issue_evidence').select('id').eq('issue_id',data.issueId).eq('actor_id',context.userId).eq('request_key',request).maybeSingle();
    if(existing.error)throw new Error('Evidence retry could not be checked.');
    if(existing.data)return {id:existing.data.id};
    const path = `staff-evidence/${data.issueId}/${crypto.randomUUID()}.${extension}`;
    const uploaded = await supabaseAdmin.storage.from('issue-photos').upload(path, bytes, { contentType: `image/${mime}`, upsert: false });
    if (uploaded.error) throw new Error('Evidence upload failed. Please try again.');
    const verified=await supabaseAdmin.storage.from('issue-photos').download(path);
    if(verified.error||!verified.data||verified.data.size!==bytes.length){await supabaseAdmin.storage.from('issue-photos').remove([path]);throw new Error('Stored evidence could not be verified. Retry upload.');}
    const saved = await context.supabase.rpc('staff_record_evidence_retry', { _id: data.issueId, _kind: data.kind, _path: path, _note: data.note, _request:request });
    if (saved.error) {
      await supabaseAdmin.storage.from('issue-photos').remove([path]);
      throw new Error(saved.error.message);
    }
    const persisted=await context.supabase.from('issue_evidence').select('storage_path').eq('id',saved.data).single();
    if(persisted.data?.storage_path!==path)await supabaseAdmin.storage.from('issue-photos').remove([path]);
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