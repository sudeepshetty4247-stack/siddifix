import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@/integrations/supabase/types';
import type { TransparencyReport } from './transparency';

export const getTransparency = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => z.object({ days: z.union([z.literal(0), z.literal(7), z.literal(30), z.literal(90), z.literal(365)]) }).parse(input))
  .handler(async ({ data }) => {
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    if (!url || !key) throw new Error('Public reports are temporarily unavailable.');
    const client = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
        headers.set('apikey', key);
        return fetch(input, { ...init, headers });
      } },
    });
    const result = await client.rpc('public_transparency_metrics', { _days: data.days });
    if (result.error) throw new Error('Public reports could not be loaded. Please try again.');
    return result.data as unknown as TransparencyReport;
  });