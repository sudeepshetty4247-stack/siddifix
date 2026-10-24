export type Counts = { total: number; active: number; resolved: number; overdue: number };
export type ReportGroup = Counts & { dimension: string; key: string; label: string };
export type RepresentativeReport = Counts & { kind: string; constituency_key: string; constituency: string; name: string | null; source_url: string | null; checked_at: string | null };
export type TransparencyReport = { generated_at: string; days: number; summary: Counts & { rejected: number; escalated: number; acknowledged: number; unmapped: number; average_resolution_days: number | null }; groups: ReportGroup[]; representatives: RepresentativeReport[]; trend: { period: string; reports: number; resolved: number }[] };

export function resolutionRate(c: Counts): number | null {
  return c.total === 0 ? null : Math.round(c.resolved / c.total * 1000) / 10;
}
export function csvCell(value: unknown) {
  const text = String(value ?? '');
  // Spreadsheet formulas must remain text, including untrusted directory names.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function transparencyCsv(r: TransparencyReport) {
  const rows: unknown[][] = [
    ['Siddhi — Your City. Your Voice.', 'Public transparency report'],
    ['Generated at', r.generated_at], ['Reporting period', r.days ? `Last ${r.days} days` : 'All time'],
    ['Basis', 'Siddhi canonical cases only. Constituency totals are not government or elected-member performance scores.'],
    ['Dimension', 'Area / constituency', 'Representative', 'Total', 'Active', 'Resolved', 'Overdue', 'Resolution %', 'Source', 'Checked at'],
    ['City', 'Bengaluru', '', r.summary.total, r.summary.active, r.summary.resolved, r.summary.overdue, resolutionRate(r.summary) ?? 'Not enough data'],
    ...r.groups.map(g => [g.dimension, g.label, '', g.total, g.active, g.resolved, g.overdue, resolutionRate(g) ?? 'Not enough data']),
    ...r.representatives.map(g => [g.kind.toUpperCase(), g.constituency, g.name ?? 'Verification required', g.total, g.active, g.resolved, g.overdue, resolutionRate(g) ?? 'Not enough data', g.source_url, g.checked_at]),
    [], ['Reporting month', 'Reports received', 'Currently resolved from that cohort'],
    ...r.trend.map(t => [t.period, t.reports, t.resolved]),
  ];
  return '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
export function downloadText(text: string, filename: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}