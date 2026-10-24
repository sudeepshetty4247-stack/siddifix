import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowRight, KeyRound, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getTracked, removeTracked, type TrackedIssue } from "@/lib/tracking";
import { StatusBadge } from "@/components/civic/StatusBadge";
import { timeAgo } from "@/lib/civic";
import { publicCases } from '@/lib/public-cases';

export const Route = createFileRoute("/_citizen/track")({
  head: () => ({
    meta: [
      { title: "My Tracking — Siddhi" },
      { name: "description", content: "Follow the reports you submitted or care about. No account needed." },
      { property: "og:title", content: "My Tracking — Siddhi" },
      { property: "og:description", content: "Track civic reports by reference code." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Track,
});

function Track() {
  const [items, setItems] = useState<TrackedIssue[]>([]);
  const [code, setCode] = useState("");
  const navigate = useNavigate();
  useEffect(() => setItems(getTracked()), []);
  const refs = items.map((i) => i.ref);
  const live = useQuery({
    queryKey: ["tracked", refs],
    enabled: refs.length > 0,
    refetchInterval: 30000,
    queryFn: async () => {
      return (await Promise.all(refs.map(ref=>publicCases(ref)))).flat();
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold sm:text-4xl">My Tracking</h1>
      <p className="mt-1 text-muted-foreground">Reports you submitted or followed on this device.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const c = code.trim().toUpperCase();
          if (c) navigate({ to: "/issues/$ref", params: { ref: c } });
        }}
        className="mt-6 flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter reference, e.g. BLR-7K2QXM" className="h-11 w-full rounded-xl border bg-card pl-9 pr-3 font-mono text-sm uppercase outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <button className="h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">Track</button>
      </form>

      <div className="mt-8 space-y-3">
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed p-10 text-center">
            <p className="font-medium">Nothing tracked yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Reports you submit are saved here automatically.</p>
            <Link to="/report" className="mt-4 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Report a problem</Link>
          </div>
        )}
        {items.map((it) => {
          const row = live.data?.find((r) => r.ref_code === it.ref);
          return (
            <div key={it.ref} className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-soft">
              {row?.photo_url ? <img src={row.photo_url} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <div className="h-14 w-14 rounded-xl bg-muted" />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{it.ref}</span>
                  {it.token && <span className="inline-flex items-center gap-1 text-xs text-primary"><KeyRound className="h-3 w-3" /> Reporter</span>}
                </div>
                <p className="truncate font-semibold">{row?.title ?? it.title}</p>
                <div className="mt-1 flex items-center gap-2">
                  {row && <StatusBadge status={row.status} />}
                  {row && <span className="text-xs text-muted-foreground">updated {timeAgo(row.updated_at)}</span>}
                </div>
              </div>
              <button onClick={() => { removeTracked(it.ref); setItems(getTracked()); }} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
              <Link to="/issues/$ref" params={{ ref: it.ref }} {...(it.token ? { hash: `t=${it.token}` } : {})} className="rounded-lg p-2 hover:bg-secondary" aria-label="Open"><ArrowRight className="h-5 w-5" /></Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
