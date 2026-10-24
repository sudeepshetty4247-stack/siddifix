import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, Globe, Menu, X, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/civic/Logo";
import { useI18n, LANGS, type TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_citizen")({
  component: CitizenLayout,
});

const NAV: { to: "/" | "/report" | "/map" | "/explore" | "/track"; key: TKey }[] = [
  { to: "/", key: "home" },
  { to: "/map", key: "map" },
  { to: "/explore", key: "explore" },
  { to: "/track", key: "track" },
];

function CitizenLayout() {
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-[1000] border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary !text-foreground" }}
              >
                {t(n.key)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <label className="relative hidden items-center sm:flex">
              <Globe className="pointer-events-none absolute left-2.5 h-4 w-4 text-muted-foreground" />
              <select
                aria-label="Language"
                value={lang}
                onChange={(e) => setLang(e.target.value as typeof lang)}
                className="h-9 appearance-none rounded-lg border bg-card pl-8 pr-3 text-sm font-medium"
              >
                {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </label>
            <Link to="/report" className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90">
              <Camera className="h-4 w-4" /> <span className="hidden sm:inline">{t("report")}</span><span className="sm:hidden">Report</span>
            </Link>
            <button className="rounded-lg p-2 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        <div className={cn("border-t bg-background md:hidden", open ? "block" : "hidden")}>
          <nav className="mx-auto flex max-w-7xl flex-col p-2">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium" activeOptions={{ exact: n.to === "/" }} activeProps={{ className: "bg-secondary" }}>
                {t(n.key)}
              </Link>
            ))}
            <div className="flex gap-2 px-3 py-3">
              {LANGS.map((l) => (
                <button key={l.id} onClick={() => setLang(l.id)} className={cn("rounded-full border px-3 py-1 text-sm", lang === l.id && "border-primary bg-primary-soft text-primary")}>{l.label}</button>
              ))}
            </div>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm space-y-3">
            <Logo />
            <p className="text-sm text-muted-foreground">Report once. Track every action. Build better communities. Operating in Bengaluru, built for every Indian city.</p>
            <p className="text-xs text-muted-foreground">CivicFix is an independent civic platform and is not an official government service. Authority names are indicative.</p>
          </div>
          <div className="flex gap-12 text-sm">
            <div className="space-y-2">
              <p className="font-semibold">Citizens</p>
              <Link to="/report" className="block text-muted-foreground hover:text-foreground">Report an issue</Link>
              <Link to="/map" className="block text-muted-foreground hover:text-foreground">Civic map</Link>
              <Link to="/track" className="block text-muted-foreground hover:text-foreground">Track a report</Link>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">Officials</p>
              <Link to="/staff" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"><ShieldCheck className="h-4 w-4" />{t("staff")}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
