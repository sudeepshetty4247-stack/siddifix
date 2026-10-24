// Shared, browser-safe civic domain data.
export const CATEGORIES = [
  { id: "roads", label: "Roads & Footpaths", emoji: "🛣️", authority: "BBMP – Road Infrastructure", subs: ["Pothole", "Damaged footpath", "Broken divider", "Open manhole", "Road cave-in"] },
  { id: "electricity", label: "Electricity & Street Lighting", emoji: "💡", authority: "BESCOM / BBMP Electrical", subs: ["Streetlight not working", "Exposed wires", "Fallen pole", "Transformer issue"] },
  { id: "water", label: "Water Supply", emoji: "🚰", authority: "BWSSB", subs: ["Pipe leakage", "No water supply", "Contaminated water", "Low pressure"] },
  { id: "drainage", label: "Drainage & Sewage", emoji: "🌊", authority: "BWSSB / BBMP Storm Water Drains", subs: ["Blocked drain", "Sewage overflow", "Waterlogging", "Missing drain cover"] },
  { id: "waste", label: "Waste Management", emoji: "🗑️", authority: "BBMP – Solid Waste Management", subs: ["Overflowing bin", "Garbage dumping", "Missed collection", "Burning waste"] },
  { id: "transport", label: "Transport & Traffic", emoji: "🚦", authority: "Bengaluru Traffic Police / BMTC", subs: ["Signal not working", "Damaged bus stop", "Missing signage", "Illegal parking"] },
  { id: "parks", label: "Parks & Public Spaces", emoji: "🌳", authority: "BBMP – Horticulture", subs: ["Broken equipment", "Unmaintained park", "Damaged bench"] },
  { id: "sanitation", label: "Public Toilets & Sanitation", emoji: "🚻", authority: "BBMP – Health & Sanitation", subs: ["Unclean toilet", "Toilet locked", "No water in toilet"] },
  { id: "trees", label: "Trees & Environment", emoji: "🌿", authority: "BBMP – Forest Cell", subs: ["Fallen tree", "Dangerous branch", "Illegal felling"] },
  { id: "buildings", label: "Public Buildings & Facilities", emoji: "🏛️", authority: "BBMP – Public Works", subs: ["Damaged structure", "Accessibility barrier"] },
  { id: "other", label: "Other Civic Infrastructure", emoji: "📍", authority: "Needs routing review", subs: ["Other"] },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const categoryById = (id: string | null | undefined) =>
  (CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1])!;

export const STATUSES = [
  "needs_classification",
  "submitted",
  "under_review",
  "assigned",
  "in_progress",
  "resolved",
  "rejected",
  "reopened",
  "closed",
] as const;
export type IssueStatus = (typeof STATUSES)[number];

export const STATUS_META: Record<IssueStatus, { label: string; tone: "neutral" | "info" | "progress" | "success" | "warning" | "danger" }> = {
  needs_classification: { label: "Needs classification", tone: "warning" },
  submitted: { label: "Submitted", tone: "neutral" },
  under_review: { label: "Under review", tone: "info" },
  assigned: { label: "Assigned", tone: "info" },
  in_progress: { label: "Work in progress", tone: "progress" },
  resolved: { label: "Resolved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  reopened: { label: "Reopened", tone: "warning" },
  closed: { label: "Closed", tone: "neutral" },
};

export const OPEN_STATUSES: IssueStatus[] = ["needs_classification", "submitted", "under_review", "assigned", "in_progress", "reopened"];

export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];
export const SEVERITY_META: Record<Severity, { label: string; slaHours: number }> = {
  low: { label: "Low", slaHours: 24 * 14 },
  medium: { label: "Medium", slaHours: 24 * 7 },
  high: { label: "High", slaHours: 72 },
  critical: { label: "Critical", slaHours: 24 },
};

// Bengaluru operational bounding box (approximate BBMP area + buffer).
export const BENGALURU = { lat: 12.9716, lng: 77.5946 };
export const isInBengaluru = (lat: number, lng: number) => lat > 12.7 && lat < 13.25 && lng > 77.35 && lng < 77.85;
export const isInIndia = (lat: number, lng: number) => lat > 6 && lat < 37.5 && lng > 68 && lng < 97.5;

export function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const units: [number, string][] = [[31536000, "y"], [2592000, "mo"], [86400, "d"], [3600, "h"], [60, "m"]];
  for (const [n, u] of units) if (s >= n) return `${Math.floor(s / n)}${u} ago`;
  return "just now";
}

export function isOverdue(issue: { sla_due_at: string | null; status: string }) {
  return !!issue.sla_due_at && OPEN_STATUSES.includes(issue.status as IssueStatus) && new Date(issue.sla_due_at).getTime() < Date.now();
}
