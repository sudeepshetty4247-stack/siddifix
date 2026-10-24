import { z } from 'zod';
import { CATEGORIES } from './civic';
import { photoMetadataSchema } from './report-photo';

export const reportInputSchema = z.object({
  idempotencyKey: z.string().uuid(),
  imageDataUrl: z.string().max(7_500_000).regex(/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/),
  description: z.string().max(1000).nullable().optional(),
  title: z.string().trim().min(3).max(120),
  summary: z.string().max(600).nullable().optional(),
  category: z.enum(CATEGORIES.map(c => c.id) as [string, ...string[]]),
  subcategory: z.string().max(80).nullable().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  aiConfidence: z.number().min(0).max(1).nullable().optional(),
  safetyWarning: z.string().max(300).nullable().optional(),
  needsClassification: z.boolean(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  landmark: z.string().max(200).nullable().optional(),
  incidentLocation:z.object({originalAddress:z.string().max(500),normalizedAddress:z.string().max(1500).optional(),source:z.enum(['manual','autocomplete','gps','map']),city:z.string().max(160).optional(),state:z.string().max(160).optional(),pin:z.string().max(20).optional(),directions:z.string().max(1000).optional()}).optional(),
  duplicateOf: z.string().uuid().nullable().optional(),
  originalPath: z.string().max(300).optional(),
  photoMetadata: photoMetadataSchema.optional(),
}).superRefine((input, context) => {
  if (!input.subcategory) return;
  const category = CATEGORIES.find(item => item.id === input.category);
  if (!category?.subs.some(sub => sub === input.subcategory)) {
    context.addIssue({ code: 'custom', path: ['subcategory'], message: 'Choose a subcategory belonging to this category.' });
  }
});