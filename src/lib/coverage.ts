/**
 * Service coverage: a city is supported only when it is explicitly enabled in the
 * verified directory (civic_coverage) AND the point lies inside an active ward polygon.
 */
export type CoverageStatus = 'supported' | 'boundary_review' | 'outside';
export function coverageFromWardMatches(matchCount: number): CoverageStatus {
  if (matchCount === 1) return 'supported';
  if (matchCount > 1) return 'boundary_review';
  return 'outside';
}

/** Backend rule: a report is accepted only for a point inside a supported ward (shared edges go to review). */
export function canAcceptReport(status: CoverageStatus) {
  return status !== 'outside';
}
