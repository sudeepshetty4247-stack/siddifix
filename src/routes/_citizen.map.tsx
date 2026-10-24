import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BENGALURU, CATEGORIES, OPEN_STATUSES, categoryById, isOverdue } from "@/lib/civic";
import { LazyMap } from "@/components/civic/LazyMap";
import { StatusBadge } from "@/components/civic/StatusBadge";
import { ISSUE_COLUMNS, type IssueRow } from "@/components/civic/IssueCard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_citizen/map")({
  head: () => ({
    meta: [
      { title: "Civic Map of Bengaluru — CivicFix" },
      { name: "description", content: "See open and resolved infrastructure issues across Bengaluru on a live map." },
      { property: "og:title", content: "Civic Map — CivicFix" },
      { property: "og:description", content: "A live map of reported potholes, streetlights, drains and more." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const [cat, setCat] = useState<string | null>(null);
  const [show, setShow] = useState<"open" | "resolved" | "all">("open");
  const q = useQuery({
    queryKey: ["map-issues"],
    queryFn: async () => {
      const { data, error } = await supabase.from("issues").select(ISSUE_COLUMNS).order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data as IssueRow[];
    },
  });
  const list = useMemo(
    () =>
      (q.data ?? []).filter(
        (i) => (!cat || i.category === cat) && (show === "all" || (show === "open" ? OPEN_STATUSES.includes(i.status as never) : !OPEN_STATUSES.includes(i.status as never))),
      ),
    [q.data, cat, show],
  );
  const markers = list.map((i) => ({
    id: i.id,
    lat: i.lat,
    lng: i.lng,
    tone: (!OPEN_STATUSES.includes(i.status as never) ? "resolved" : i.severity === "critical" ? "critical" : isOverdue(i) ? "overdue" : "open") as "open",
    label: i.title,
    sub: `${categoryById(i.category).label} · ${i.ref_code}`,
    href: `/issues/${i.ref_code}`,
  }));

  return (
    <div className="grid h-[calc(100vh-4rem)] lg:grid-cols-[380px_1fr]">
      <aside className="order-2 flex min-h-0 flex-col border-r bg-card lg:order-1">
        <div className="space-y-3 border-b p-4">
          <h1 className="text-xl font-bold">Civic Map</h1>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1 text-sm">
            {(["open", "resolved", "all"] as const).map((s) => (
              <button key={s} onClick={() => setShow(s)} className={cn("rounded-lg py-1.5 font-medium capitalize", show === s ? "bg-card shadow-soft" : "text-muted-foreground")}>{s}</button>
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button onClick={() => setCat(null)} className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-medium", !cat && "border-primary bg-primary-soft text-primary")}>All</button>
            {CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-medium", cat === c.id && "border-primary bg-primary-soft text-primary")}>{c.emoji} {c.label.split(" ")[0]}</button>
            ))}
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-primary" />Open</span>
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-warning" />Overdue</span>
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-destructive" />Critical</span>
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-success" />Resolved</span>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {list.length === 0 && !q.isLoading && <p className="p-6 text-center text-sm text-muted-foreground">No issues match these filters yet.</p>}
          {list.map((i) => (
            <Link key={i.id} to="/issues/$ref" params={{ ref: i.ref_code }} className="flex gap-3 border-b p-3 transition hover:bg-secondary">
              {i.photo_url ? <img src={i.photo_url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" loading="lazy" /> : <div className="h-16 w-16 shrink-0 rounded-lg bg-muted" />}
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-semibold">{i.title}</p>
                <p className="truncate text-xs text-muted-foreground">{categoryById(i.category).label}</p>
                <StatusBadge status={i.status} />
              </div>
            </Link>
          ))}
        </div>
      </aside>
      <div className="order-1 h-[50vh] lg:order-2 lg:h-auto">
        <LazyMap center={BENGALURU} zoom={12} markers={markers} />
      </div>
    </div>
  );
}
