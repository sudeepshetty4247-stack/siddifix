// Device-local list of reports this citizen submitted or follows (no login required).
export type TrackedIssue = { ref: string; token?: string; title: string; savedAt: string };
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
  const list = getTracked().filter((i) => i.ref !== item.ref);
  list.unshift(item);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)));
}
export function removeTracked(ref: string) {
  localStorage.setItem(KEY, JSON.stringify(getTracked().filter((i) => i.ref !== ref)));
}
export function isTracked(ref: string) {
  return getTracked().some((i) => i.ref === ref);
}
