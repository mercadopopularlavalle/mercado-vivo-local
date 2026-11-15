import { Link } from "@tanstack/react-router";

export function Logo() {
  return (
    <Link to="/" search={{}} className="flex items-center gap-2.5 shrink-0" aria-label="Mercado Popular, inicio">
      <img
        src="/logo.jpeg"
        alt="Mercado Popular"
        className="size-10 rounded-xl object-contain bg-white p-0.5 shadow-sm"
      />
      <span className="font-display text-lg font-extrabold leading-none tracking-tight text-primary-foreground">
        Mercado
        <span className="block text-highlight">Popular</span>
      </span>
    </Link>
  );
}
