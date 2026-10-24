import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { photonResults } from './address-search';

// OpenStreetMap Nominatim: a configured hosted instance is preferred; otherwise the public
// endpoint is used for on-demand reverse lookup only, never autocomplete.
// Search-as-you-type uses Photon, which explicitly supports autocomplete.
const PUBLIC_ENDPOINT = 'https://nominatim.openstreetmap.org/';
const USER_AGENT = 'CivicFix-Bengaluru/1.0 (civic issue reporting)';
const ATTRIBUTION = 'https://www.openstreetmap.org/copyright';
// Greater Bengaluru search box (lon,lat,lon,lat)

function endpoint(path: string) {
  const configured = process.env['CIVICFIX_NOMINATIM_URL'];
  const base = configured && configured.startsWith('https://') ? configured : PUBLIC_ENDPOINT;
  return new URL(path, base.endsWith('/') ? base : `${base}/`);
}

async function limited(kind: string, limit: number) {
  try { const { consumeRequest } = await import('./civic-security.server'); await consumeRequest(kind, limit); return true; }
  catch { return false; }
}

function shortLabel(address: Record<string, string> | undefined, display: string) {
  if (!address) return display;
  const parts = [address['road'] ?? address['railway'] ?? address['amenity'] ?? address['residential'], address['neighbourhood'] ?? address['suburb'] ?? address['quarter'], address['city_district'] ?? address['city'], address['postcode']].filter(Boolean);
  return parts.length >= 2 ? Array.from(new Set(parts)).join(', ') : display;
}

export const reverseGeocode = createServerFn({ method: 'POST' })
  .inputValidator((input: { lat: number; lng: number }) => z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(input))
  .handler(async ({ data }) => {
    if (!(await limited('reverse-geocode', 60))) return { address: null, area: null, sourceUrl: null, checkedAt: null, notice: 'Too many place lookups. Your confirmed pin remains usable.' };
    const url = endpoint('reverse');
    url.search = new URLSearchParams({ lat: String(data.lat), lon: String(data.lng), format: 'jsonv2', zoom: '18', addressdetails: '1', 'accept-language': 'en' }).toString();
    try {
      const response = await fetch(url, { signal:AbortSignal.timeout(8000),headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, Referer: 'https://siddifix.lovable.app' } });
      if (!response.ok) return { address: null, area: null, sourceUrl: null, checkedAt: null, notice: `Place lookup unavailable (${response.status}). Your report can still be submitted.` };
      const result = z.object({ display_name: z.string().max(1000).optional(), address: z.record(z.string(), z.string()).optional() }).parse(await response.json());
      const a = result.address;
      const area = a ? (a['suburb'] ?? a['neighbourhood'] ?? a['quarter'] ?? a['city_district'] ?? null) : null;
      return { address: result.display_name ? shortLabel(a, result.display_name) : null, area, sourceUrl: ATTRIBUTION, checkedAt: new Date().toISOString(), notice: result.display_name ? null : 'No street address found. Ward matching still uses the confirmed coordinates.' };
    } catch {
      return { address: null, area: null, sourceUrl: null, checkedAt: null, notice: 'Place lookup is unavailable. Your report can still be submitted.' };
    }
  });

export const searchAddress = createServerFn({ method: 'POST' })
  .inputValidator((input: { query: string }) => z.object({ query: z.string().trim().min(3).max(160) }).parse(input))
  .handler(async ({ data }) => {
    const empty = { results: [] as import('./address-search').AddressResult[], notice: 'No places found. Try a more complete address.' as string | null };
    if (!(await limited('address-search', 100))) return { ...empty, notice: 'Location search limit reached. Please wait or enter your address manually.' };
    const base=process.env['SIDDI_PHOTON_URL']??'https://photon.komoot.io/';
    const url = new URL('api/',base);
    url.search = new URLSearchParams({ q: data.query, limit: '8', bbox:'68,6,98,38', lang:'en' }).toString();
    try {
      const r = await fetch(url, { signal:AbortSignal.timeout(8000), headers: { Accept: 'application/json', 'User-Agent': USER_AGENT } });
      if (!r.ok) return { ...empty, notice: r.status===429?'Location service is busy. Wait a moment and retry.':'Address suggestions aren’t loading right now. You can still enter the address manually.' };
      const results = photonResults(await r.json());
      return { results, notice: results.length ? null : empty.notice };
    } catch { return { ...empty, notice: 'Address suggestions aren’t loading right now. You can still enter the address manually.' }; }
  });
