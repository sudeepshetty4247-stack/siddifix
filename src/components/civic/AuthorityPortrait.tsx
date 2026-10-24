import { useState } from 'react';

export function authorityInitials(name: string) {
  return name.replace(/^(Dr\.|Shri|Smt\.)\s*/i, '').split(/[\s.]+/).filter(word => word.length > 1).slice(0, 2).map(word => word[0]?.toUpperCase()).join('');
}

export function AuthorityPortrait({ name, role, url, source, verified = false }: { name: string; role: string; url?: string | null | undefined; source?: string | null | undefined; verified?: boolean | undefined }) {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  // A profile verification alone does not establish a portrait's provenance.
  const image = verified && (url?.startsWith('https://') || url?.startsWith('/__l5e/assets-v1/') || /^\/api\/public\/officer-portrait\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(url ?? '')) && source?.startsWith('https://') && failedUrl !== url ? url : null;
  return <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft font-display text-sm font-bold text-primary">
    <span aria-label={`${name}, ${role}`} className={image && loadedUrl !== image ? 'invisible' : undefined}>{authorityInitials(name)}</span>
    {image && <img key={image} src={image} alt={`${name} — ${role}`} width={48} height={48} loading="lazy" decoding="async" referrerPolicy="no-referrer" className={`absolute inset-0 h-full w-full object-cover ${loadedUrl === image ? '' : 'invisible'}`} onLoad={() => setLoadedUrl(image)} onError={() => setFailedUrl(image)} />}
  </span>;
}

export function PortraitCredit({ source, credit, license, verified }: { source: string | null; credit: string | null; license: string | null; verified: boolean }) {
  if (!verified || !source?.startsWith('https://') || !credit) return null;
  return <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground"><a href={source} target="_blank" rel="noopener noreferrer" className="underline">Photo: {credit}</a>{license?.startsWith('https://') && <> · <a href={license} target="_blank" rel="noopener noreferrer" className="underline">Licence</a></>} · cropped to fit</p>;
}