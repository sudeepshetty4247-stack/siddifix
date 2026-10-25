// Private tracking-link contract. The token is a 192-bit random hex string,
// stored only as a hash in the database; the reference alone never grants access.
export const TRACKING_TOKEN_RE = /^[a-f0-9]{48}$/;
export const CASE_REF_RE = /^(?:[A-Z]{3}-[A-Z2-9]{6}|DEMO-[A-Z0-9-]{3,40}-[0-9]{5})$/;

export function isValidTrackingToken(token: string): boolean {
  return TRACKING_TOKEN_RE.test(token);
}

export function isValidCaseRef(ref: string): boolean {
  return CASE_REF_RE.test(ref);
}
