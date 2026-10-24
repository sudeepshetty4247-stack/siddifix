export function authorityMatchesWard(profile: { kind: string; ward_identifier: string | null; corporation: string | null; category: string | null; zone: string | null }, ward: { identifier: string; corporation: string; zone: string | null }, category?: string) {
  const elected = profile.kind === 'mla' || profile.kind === 'mp';
  // Elected profile zone holds a constituency, not an operational city zone.
  return (!profile.ward_identifier || profile.ward_identifier === ward.identifier)
    && (!profile.corporation || profile.corporation === ward.corporation)
    && (!profile.category || profile.category === category)
    && (elected || !profile.zone || profile.zone === ward.zone);
}