import { createFileRoute } from "@tanstack/react-router";
import { NotificationCentre } from "@/components/portals/NotificationCentre";
export const Route = createFileRoute("/_authenticated/admin/notifications")({
  head: () => ({ meta: [{ title: "Admin notification centre — Siddhi" }, { name: "description", content: "Every notification Siddhi actually recorded, with honest delivery states." }, { property: "og:title", content: "Admin notification centre — Siddhi" }, { property: "og:description", content: "Every notification Siddhi actually recorded, with honest delivery states." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: () => <NotificationCentre admin={true}/>,
});
