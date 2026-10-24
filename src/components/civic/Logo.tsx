import { Link } from "@tanstack/react-router";
import mark from "@/assets/siddhi-mark.png.asset.json";

export function Logo({ to = "/", tone = "default" }: { to?: "/" | "/staff" | "/admin"; tone?: "default" | "inverse" }) {
  return (
    <Link to={to} className="flex shrink-0 items-center gap-2" aria-label="Siddhi home — Your City. Your Voice.">
      <img src={mark.url} alt="" width={34} height={38} className="h-10 w-auto" />
      <span className="flex flex-col">
      <span className={`font-brand text-[30px] font-extrabold leading-none tracking-normal ${tone === 'inverse' ? 'text-sidebar-accent-foreground' : 'text-foreground'}`}>Siddhi</span>
      <span className={`mt-1 text-[10px] font-medium leading-none tracking-wide ${tone === 'inverse' ? 'text-sidebar-primary' : 'text-primary'}`}>Your City. Your Voice.</span>
      </span>
    </Link>
  );
}
