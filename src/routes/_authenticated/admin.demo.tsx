import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Database, ShieldAlert, FlaskConical, Trash2, CircleCheck, CircleAlert, Info, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMasterDataValidation, getDemoDatasetStatus, seedDemoDataset, purgeDemoDataset, previewDemoPurge } from "@/lib/demo.functions";

export const Route = createFileRoute("/_authenticated/admin/demo")({
  head: () => ({ meta: [{ title: "Data health & demo — Siddhi" }, { name: "description", content: "Master-data validation and labelled demo dataset controls." }, { property: "og:title", content: "Data health & demo — Siddhi" }, { property: "og:description", content: "Master-data validation and demo dataset controls." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: DemoPage,
});

const severityIcon = (s: string) =>
  s === 'ok' ? <CircleCheck className="h-4 w-4 text-primary" /> :
  s === 'info' ? <Info className="h-4 w-4 text-muted-foreground" /> :
  s === 'warning' ? <CircleAlert className="h-4 w-4 text-warning-foreground" /> :
  <CircleAlert className="h-4 w-4 text-destructive" />;

type Cred = { email: string; password: string; department?: string; role?: string };
type Sample = { ref: string; token: string; status: string };

function DemoPage() {
  const validateFn = useServerFn(getMasterDataValidation);
  const statusFn = useServerFn(getDemoDatasetStatus);
  const seedFn = useServerFn(seedDemoDataset);
  const purgeFn = useServerFn(purgeDemoDataset);
  const previewFn = useServerFn(previewDemoPurge);
  const qc = useQueryClient();
  const validation = useQuery({ queryKey: ["master-data-validation"], queryFn: () => validateFn(), retry: false });
  const status = useQuery({ queryKey: ["demo-dataset-status"], queryFn: () => statusFn(), retry: false });
  const [count, setCount] = useState("2100");
  const [perDept, setPerDept] = useState("10");
  const [datasetId, setDatasetId] = useState("demo-v1");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Cred[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [preview, setPreview] = useState<Record<string, number | string | boolean> | null>(null);

  async function seed() {
    setBusy(true); setProgress("Preparing teams and staff…");
    try {
      let offset = 0;
      for (let guard = 0; guard < 20; guard++) {
        const r = await seedFn({ data: { count: Number(count), staffPerDepartment: Number(perDept), datasetId, offset, limit: 250 } });
        if (r.credentials) setCredentials(prev => [...prev, ...r.credentials!]);
        if (r.adminCredential) setCredentials(prev => [...prev, { ...r.adminCredential!, role: 'admin' }]);
        if (r.samples) setSamples(r.samples);
        if (r.rejected?.length) toast.warning(`${r.rejected.length} batches rejected: ${r.rejected[0]}`);
        setProgress(`Inserted up to report ${Math.min(r.nextOffset ?? Number(count), Number(count))} of ${count}…`);
        if (r.done) break;
        offset = r.nextOffset ?? Number(count);
      }
      toast.success("Demo dataset complete.");
      qc.invalidateQueries({ queryKey: ["demo-dataset-status"] });
      qc.invalidateQueries({ queryKey: ["master-data-validation"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Seeding failed."); }
    setBusy(false); setProgress(null);
  }
  async function dryRun(id: string) {
    setBusy(true);
    try { setPreview(await previewFn({ data: { datasetId: id } })); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Preview failed."); }
    setBusy(false);
  }
  async function purge(id: string) {
    if (!window.confirm(`Permanently delete demo dataset "${id}"? Only synthetic records labelled with this dataset id are removed; genuine records are never touched.`)) return;
    setBusy(true);
    try {
      const r = await purgeFn({ data: { datasetId: id } }) as any;
      toast.success(`Purged ${r.issues ?? 0} reports, ${r.teams ?? 0} teams, ${r.profiles ?? 0} staff profiles, ${r.authUsersRemoved ?? 0} accounts.`);
      setCredentials([]); setSamples([]); setPreview(null);
      qc.invalidateQueries({ queryKey: ["demo-dataset-status"] });
      qc.invalidateQueries({ queryKey: ["master-data-validation"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Purge failed."); }
    setBusy(false);
  }

  const checks = validation.data?.checks ?? [];
  const problems = checks.filter(c => c.severity === 'error' || c.severity === 'warning');

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Database className="h-6 w-6 text-primary" />Data health & demo</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Validates the master data every workflow depends on, and manages synthetic demonstration data. Demo records are always labelled, never appear in public metrics, and can be purged safely.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Master-data validation</h2>
        {validation.isPending && <p role="status" className="text-sm text-muted-foreground">Checking configuration…</p>}
        {validation.isError && <p role="alert" className="text-sm text-destructive">Validation could not run.</p>}
        {validation.data && (
          <>
            <p className="text-sm text-muted-foreground">{problems.length === 0 ? "No configuration problems found." : `${problems.length} item${problems.length === 1 ? "" : "s"} need attention.`}</p>
            <ul className="divide-y rounded-xl border bg-card">
              {checks.map(c => (
                <li key={c.check} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5">{severityIcon(c.severity)}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{c.check.replaceAll('_', ' ')}{c.count > 0 ? ` — ${c.count}` : ""}</p>
                    <p className="text-xs text-muted-foreground">{c.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><FlaskConical className="h-5 w-5 text-primary" />Synthetic demo dataset</h2>
        {status.data && !status.data.enabled && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />Demo seeding is disabled in this environment.</p>
        )}
        {status.data?.datasets.length ? (
          <ul className="space-y-2">
            {status.data.datasets.map(d => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm">
                <span><strong>{d.id}</strong> — {d.issues} reports · {d.teams} teams · {d.staff} staff</span>
                {status.data.enabled && <span className="flex gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => dryRun(d.id)}>Preview cleanup</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => purge(d.id)}><Trash2 className="mr-1 h-3.5 w-3.5" />Purge</Button></span>}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">No demo datasets exist.</p>}

        {preview && (
          <div className="space-y-2 rounded-lg border p-4 text-sm">
            <p className="font-semibold">Cleanup preview — {String(preview['dataset'])}</p>
            <p className="text-muted-foreground">Removes {String(preview['issues'])} reports, {String(preview['events'])} timeline events, {String(preview['notifications'])} notifications, {String(preview['feedback'])} feedback entries, {String(preview['photos'])} photos, {String(preview['secrets'])} tracking secrets, {String(preview['teams'])} teams and {String(preview['staff_profiles'])} staff profiles.</p>
            {preview['safe_to_purge']
              ? <p className="text-primary">Safe: no genuine record references this dataset.</p>
              : <p className="text-destructive">Blocked: {String(preview['genuine_records_blocked'])} genuine record(s) reference this dataset. Purge will refuse to run.</p>}
          </div>
        )}

        {status.data?.enabled && (
          <div className="space-y-3 border-t pt-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2">Dataset id <input aria-label="Dataset id" value={datasetId} onChange={e => setDatasetId(e.target.value)} className="h-9 w-32 rounded-md border bg-background px-2" /></label>
              <label className="flex items-center gap-2">Reports <input aria-label="Report count" type="number" min={50} max={5000} value={count} onChange={e => setCount(e.target.value)} className="h-9 w-24 rounded-md border bg-background px-2" /></label>
              <label className="flex items-center gap-2">Staff per department <input aria-label="Staff per department" type="number" min={2} max={25} value={perDept} onChange={e => setPerDept(e.target.value)} className="h-9 w-20 rounded-md border bg-background px-2" /></label>
            </div>
            <Button disabled={busy} onClick={seed}>{busy ? (progress ?? "Working…") : "Generate demo dataset"}</Button>
            <p className="text-xs text-muted-foreground">Creates labelled synthetic teams, staff accounts and reports with realistic timelines. Safe to retry — existing reports are skipped. Demo sign-in passwords are shown once below.</p>
          </div>
        )}

        {credentials.length > 0 && (
          <div className="space-y-2 rounded-lg border border-warning bg-secondary p-4">
            <p className="text-sm font-semibold">Demo sign-in details (shown until the next purge)</p>
            <ul className="max-h-64 space-y-1 overflow-y-auto font-mono text-xs">
              {credentials.map(c => <li key={c.email}>{c.email} · {c.password} · {c.role}</li>)}
            </ul>
          </div>
        )}

        {samples.length > 0 && (
          <div className="space-y-2 rounded-lg border p-4">
            <p className="flex items-center gap-2 text-sm font-semibold"><Link2 className="h-4 w-4" />Presenter tracking links (synthetic)</p>
            <ul className="space-y-1 font-mono text-xs">
              {samples.map(s => <li key={s.ref}><a className="text-primary underline" href={`/track?ref=${s.ref}&token=${s.token}`} target="_blank" rel="noreferrer">{s.ref}</a> · {s.status}</li>)}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
