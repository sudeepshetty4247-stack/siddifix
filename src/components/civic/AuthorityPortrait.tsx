import { useState } from 'react';

export function authorityInitials(name: string) {
  return name.replace(/^(Dr\.|Shri|Smt\.)\s*/i, '').split(/[\s.]+/).filter(word => word.length > 1).slice(0, 2).map(word => word[0]?.toUpperCase()).join('');
}

export function AuthorityPortrait({ name, role, url, source }: { name: string; role: string; url?: string | null; source?: string | null }) {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  // A profile verification alone does not establish a portrait's provenance.
  const image = url?.startsWith('https://') && source?.startsWith('https://') && failedUrl !== url ? url : null;
  return <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft font-display text-sm font-bold text-primary">
    <span aria-label={`${name}, ${role}`} className={image && loadedUrl !== image ? 'invisible' : undefined}>{authorityInitials(name)}</span>
    {image && <img key={image} src={image} alt={`${name} — ${role}`} width={48} height={48} loading="lazy" decoding="async" referrerPolicy="no-referrer" className={`absolute inset-0 h-full w-full object-cover ${loadedUrl === image ? '' : 'invisible'}`} onLoad={() => setLoadedUrl(image)} onError={() => setFailedUrl(image)} />}
  </span>;
}