import { z } from 'zod';
export const evidenceInput = z.object({
  issueId: z.string().uuid(),
  kind: z.enum(['inspection', 'completion', 'external_action']),
  note: z.string().trim().min(5).max(1000),
  imageDataUrl: z.string().max(7_500_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
});
export function decodeEvidenceImage(url: string) {
  const match = url.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
  if (!match?.[1] || !match[2]) throw new Error('Choose a valid evidence image.');
  const mime = match[1];
  const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
  if (bytes.length > 5_500_000) throw new Error('The processed evidence photo is too large.');
  const valid = mime === 'png' ? bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 : mime === 'webp' ? String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP' : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!valid) throw new Error('The image contents do not match the file format.');
  return { bytes, mime, extension: mime === 'jpeg' ? 'jpg' : mime };
}