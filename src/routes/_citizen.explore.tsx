import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, STATUSES, STATUS_META } from "@/lib/civic";
import { IssueCard, ISSUE_COLUMNS, type IssueRow } from "@/components/civic/IssueCard";
import { WardLeaderboard } from "@/components/civic/WardLeaderboard";
import { publicCases } from '@/lib/public-cases';
import { useShowcase, ShowcaseBadge } from '@/lib/showcase';

export const Route = createFileRoute("/_citizen/explore")({
  head: () => ({
    meta: [
      { title: "Explore civic issues — Siddhi" },
      { name: "description", content: "Browse and search every public infrastructure report in Bengaluru by category and status." },
      { property: "og:title", content: "Explore civic issues — Siddhi" },
      { property: "og:description", content: "Every report, every status, fully public." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Explore,
});

function Explore() {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<"new" | "support">("new");
  const { showcase } = useShowcase();
  const q = useQuery({
    queryKey: ["explore", search, cat, status, sort, showcase],
    queryFn: async () => {
      const rows = await publicCases(undefined, showcase);
      const filtered = rows.filter(i=>(!cat || i.category===cat) && (!status || i.status===status) && (!search.trim() || `${i.title} ${i.landmark ?? ''} ${i.ref_code}`.toLowerCase().includes(search.trim().toLowerCase())));
      return (sort==='support' ? filtered.sort((a,b)=>b.support_count-a.support_count) : filtered).slice(0,60) as IssueRow[];
    },
  });

  const sel = "h-11 rounded-xl border bg-card px-3 text-sm";
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold sm:text-4xl">Explore issues</h1>
      <p className="mt-1 flex flex-wrap items-center gap-3 text-muted-foreground">Every report submitted to Siddhi, publicly visible.<ShowcaseBadge /></p>
      <div className="mt-6 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title, landmark or reference…" className="h-11 w-full rounded-xl border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className={sel} aria-label="Category">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={sel} aria-label="Status">
          <option value="">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as "new")} className={sel} aria-label="Sort">
          <option value="new">Newest</option>
          <option value="support">Most reported</option>
        </select>
      </div>
      <div className="mt-8">
        {q.isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />)}</div>
        ) : q.data?.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{q.data.map((i) => <IssueCard key={i.id} issue={i} />)}</div>
        ) : (
          <p className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">No issues match your filters.</p>
        )}
      </div>
      <div className="mx-auto mt-10 max-w-2xl rounded-2xl border bg-card">
        <WardLeaderboard />
      </div>
    </div>
  );
}
