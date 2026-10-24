// Device-local list of reports this citizen submitted or follows (no login required).
export type TrackedIssue = { ref: string; token?: string | undefined; title: string; savedAt: string };
const KEY = "civicfix.tracked.v1";

export function getTracked(): TrackedIssue[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
export function saveTracked(item: TrackedIssue) {
  const previous = getTracked().find(i => i.ref === item.ref);
  const list = getTracked().filter((i) => i.ref !== item.ref);
  list.unshift({ ...item, token: item.token ?? previous?.token });
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100))); } catch { /* The reference and private link remain available on screen. */ }
}
export function removeTracked(ref: string) {
  localStorage.setItem(KEY, JSON.stringify(getTracked().filter((i) => i.ref !== ref)));
}
export function isTracked(ref: string) {
  return getTracked().some((i) => i.ref === ref);
}
