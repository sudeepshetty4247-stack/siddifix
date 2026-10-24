import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Logo } from "@/components/civic/Logo";
import { BackButton } from "@/components/civic/BackButton";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff sign in — Siddi" },
      { name: "description", content: "Sign in to the Siddi staff workspace to manage and resolve civic issues." },
      { property: "og:title", content: "Staff sign in — Siddi" },
      { property: "og:description", content: "Workspace for officials and field teams." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/staff", replace: true }); });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/staff", replace: true });
      } else {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth` } });
        if (error) throw error;
        toast.success("Confirm your email. Workspace access must be granted separately; signup does not grant staff or administrator access.");
        setMode("in");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-12 text-ink-foreground lg:flex">
        <Logo tone="inverse" />
        <div className="max-w-md space-y-4">
          <ShieldCheck className="h-10 w-10 text-sidebar-primary" />
          <h1 className="text-4xl font-bold">The workspace for people who fix cities.</h1>
          <p className="opacity-75">Triage reports, assign ownership, record evidence and keep every citizen informed — with a full audit trail.</p>
        </div>
        <p className="text-xs opacity-50">Access is granted by your Siddi administrator.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <BackButton />
          <div className="lg:hidden"><Logo /></div>
          <div>
            <h2 className="text-2xl font-bold">Staff sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">Citizens don't need an account — <Link to="/report" className="font-medium text-primary">report an issue here</Link>.</p><p className="mt-2 text-xs text-muted-foreground">Accounts require separately granted workspace access. Creating an account never makes you an administrator.</p>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work email" className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 8 characters)" className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <button disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}{mode === "in" ? "Sign in" : "Create account"}
            </button>
          </form>
          <p className="text-center text-xs text-muted-foreground">No account? Ask your Siddi administrator for staff access.</p>
        </div>
      </div>
    </div>
  );
}
