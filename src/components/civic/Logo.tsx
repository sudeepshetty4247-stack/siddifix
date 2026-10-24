import { Link } from "@tanstack/react-router";
import mark from "@/assets/siddhi-mark.png.asset.json";

export function Logo({ to = "/", tone = "default" }: { to?: "/" | "/staff" | "/admin"; tone?: "default" | "inverse" }) {
  return (
    <Link to={to} className="flex shrink-0 items-center gap-2" aria-label="Siddhi home — Your City. Your Voice.">
      <img src={mark.url} alt="" width={34} height={38} className="h-10 w-auto" />
      <span className="flex flex-col">
      <span className={`font-brand text-[30px] font-extrabold leading-none tracking-normal ${tone === 'inverse' ? 'text-sidebar-accent-foreground' : 'text-foreground'}`}>Sidd<span className="text-brand-gradient italic">hi</span><span className="ml-0.5 inline-block size-1.5 rounded-full bg-warning align-baseline" aria-hidden /></span>
      <span className={`mt-1 text-[10px] font-semibold uppercase leading-none tracking-[0.14em] ${tone === 'inverse' ? 'text-sidebar-primary' : 'text-primary'}`}>Your City. Your Voice.</span>
      </span>
    </Link>
  );
}
