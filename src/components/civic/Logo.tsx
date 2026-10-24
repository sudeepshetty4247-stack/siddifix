import { Link } from "@tanstack/react-router";
import logo from '@/assets/siddi-logo.png.asset.json';

export function Logo({ to = "/", tone = "default" }: { to?: "/" | "/staff"; tone?: "default" | "inverse" }) {
  return (
    <Link to={to} className="flex shrink-0 items-center rounded-md bg-card px-2 py-1" aria-label="Siddi home — Your City. Your Voice.">
      <img src={logo.url} alt="Siddi — Your City. Your Voice." width={1504} height={1005} className="h-16 w-24 object-contain" />
    </Link>
  );
}
