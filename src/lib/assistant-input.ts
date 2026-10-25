import { z } from 'zod';
// Only visible text is accepted. Clients cannot inject system roles, tools or private context.
export const assistantInput = z.object({
  serviceArea: z.string().regex(/^[a-z0-9-]{2,60}$/).optional(),
  messages: z.array(z.object({
    id: z.string().min(1).max(160),
    role: z.enum(['user', 'assistant']),
    parts: z.array(z.union([
      z.object({ type: z.literal('text'), text: z.string().max(12000) }),
      z.object({ type: z.literal('reasoning'), text: z.string().max(16000) }),
      z.object({ type: z.literal('step-start') }),
    ])).max(24),
  })).min(1).max(80),
}).refine(v => v.messages.reduce((n, m) => n + m.parts.reduce((s, p) => s + ('text' in p ? p.text.length : 0), 0), 0) <= 100000, 'This conversation is too long. Start a new visit to continue.');