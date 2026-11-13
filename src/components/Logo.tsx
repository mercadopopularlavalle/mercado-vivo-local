import { Link } from "@tanstack/react-router";

export function Logo() {
  return (
    <Link to="/" search={{}} className="flex items-center gap-2.5 shrink-0" aria-label="Mercado Popular, inicio">
      <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground font-display text-lg font-extrabold shadow-sm">
        M
      </span>
      <span className="font-display text-lg font-extrabold leading-none tracking-tight text-primary-foreground">
        Mercado
        <span className="block text-accent">Popular</span>
      </span>
    </Link>
  );
}
