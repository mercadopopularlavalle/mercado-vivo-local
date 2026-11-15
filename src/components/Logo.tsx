import { Link } from "@tanstack/react-router";

export function Logo() {
  return (
    <Link to="/" search={{}} className="flex items-center gap-3 shrink-0 py-1" aria-label="Mercado Popular, inicio">
      <img
        src="/logo.jpeg"
        alt="Mercado Popular"
        className="size-13 sm:size-16 rounded-2xl object-contain bg-white p-1 shadow-md transition-transform hover:scale-105"
      />
      <span className="font-display text-xl sm:text-2xl font-extrabold leading-none tracking-tight text-primary-foreground">
        Mercado
        <span className="block text-highlight">Popular</span>
      </span>
    </Link>
  );
}
