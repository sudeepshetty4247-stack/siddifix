import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import type { Directory } from './directory';

export const getDirectory = createServerFn({ method: 'GET' }).handler(async (): Promise<Directory> => {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new Error('The civic directory is temporarily unavailable.');
  const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
    headers.set('apikey', key);
    return fetch(input, { ...init, headers });
  } } });
  const [coverage, authorities, rules, wards] = await Promise.all([
    client.from('civic_coverage').select('id,name,state,bounds,notice,source_url,verified_at'),
    client.from('civic_authorities').select('id,coverage_id,name,kind,website_url,reporting_url,phone,source_url,verified_at,notes'),
    client.from('civic_service_rules').select('authority_id,category,subcategory,notes,confidence'),
    client.from('civic_wards').select('name,identifier,corporation,boundary,source_url,verified_at,representative,representative_source_url'),
  ]);
  for (const result of [coverage, authorities, rules, wards]) if (result.error) throw new Error('The civic directory could not be loaded.');
  return { coverage: coverage.data ?? [], authorities: authorities.data ?? [], rules: rules.data ?? [], wards: wards.data ?? [] };
});