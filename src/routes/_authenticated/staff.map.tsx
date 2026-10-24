import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BENGALURU, OPEN_STATUSES, categoryById, isOverdue } from "@/lib/civic";
import { LazyMap } from "@/components/civic/LazyMap";

export const Route = createFileRoute("/_authenticated/staff/map")({
  head: () => ({ meta: [{ title: "Staff map and hotspots — Siddi" }, { name: "description", content: "Review geographic patterns in recorded open civic reports." }, { property: "og:title", content: "Staff map and hotspots — Siddi" }, { property: "og:description", content: "Review geographic patterns in recorded open civic reports." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: StaffMap,
});

function StaffMap() {
  const q = useQuery({
    queryKey: ["staff-map"],
    queryFn: async () => {
      const { data } = await supabase.from("issues").select("id, ref_code, title, category, severity, status, sla_due_at, lat, lng").in("status", OPEN_STATUSES).limit(1000);
      return data ?? [];
    },
  });
  // Simple hotspot detection: ~500m grid cells with 3+ open issues
  const cells = new Map<string, { n: number; lat: number; lng: number }>();
  for (const i of q.data ?? []) {
    const k = `${(i.lat / 0.0045).toFixed(0)}:${(i.lng / 0.0045).toFixed(0)}`;
    const c = cells.get(k) ?? { n: 0, lat: 0, lng: 0 };
    cells.set(k, { n: c.n + 1, lat: c.lat + i.lat, lng: c.lng + i.lng });
  }
  const hotspots = [...cells.values()].filter((c) => c.n >= 3).sort((a, b) => b.n - a.n);
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col lg:h-screen">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div>
          <h1 className="text-2xl font-bold">Map & Hotspots</h1>
          <p className="text-sm text-muted-foreground">{q.data?.length ?? 0} open issues · {hotspots.length} hotspot{hotspots.length === 1 ? "" : "s"} (3+ issues within ~500 m)</p>
        </div>
      </div>
      <div className="flex-1">
        <LazyMap
          center={BENGALURU}
          zoom={12}
          markers={(q.data ?? []).map((i) => ({
            id: i.id, lat: i.lat, lng: i.lng,
            tone: i.severity === "critical" ? "critical" : isOverdue(i) ? "overdue" : "open",
            label: i.title, sub: `${categoryById(i.category).label} · ${i.ref_code}`, href: `/staff/issues/${i.id}`,
          }))}
        />
      </div>
    </div>
  );
}
