import { useEffect, useRef, useState, type ComponentType, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronRight, Flame, LayoutGrid, PackageSearch, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/ListingCard";
import { UsefulContacts } from "@/components/UsefulContacts";
import { CATEGORIES, categoryLabel, isCategorySlug, type CategorySlug } from "@/lib/categories";
import { listingsQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

type HomeSearch = { q?: string | undefined; cat?: CategorySlug | undefined; hoy?: boolean | undefined };

export const Route = createFileRoute("/comprar")({
  validateSearch: (search: Record<string, unknown>): HomeSearch => ({
    q: typeof search["q"] === "string" && search["q"].trim() ? search["q"].trim() : undefined,
    cat: isCategorySlug(search["cat"]) ? search["cat"] : undefined,
    hoy: search["hoy"] === true || search["hoy"] === "true" ? true : undefined,
  }),
  loaderDeps: ({ search }) => ({ q: search.q, cat: search.cat }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(listingsQuery(deps.q, deps.cat)),
  head: () => ({
    meta: [
      { title: "Comprar en Lavalle — Productos y servicios | Mercado Popular" },
      {
        name: "description",
        content:
          "Los negocios de Lavalle en un solo lugar. Comprá y vendé cerca tuyo: hogar, indumentaria, comidas, pesca, limpieza, Navidad y más. Contactá al vendedor por WhatsApp.",
      },
      { property: "og:title", content: "Comprar en Lavalle — Productos y servicios | Mercado Popular" },
      {
        property: "og:description",
        content: "Los negocios de Lavalle en un solo lugar. Comprá y vendé cerca tuyo y contactá al vendedor directo por WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { q, cat, hoy } = Route.useSearch();
  const navigate = useNavigate({ from: "/comprar" });
  const { data: listings } = useSuspenseQuery(listingsQuery(q, cat));
  const [term, setTerm] = useState(q ?? "");
  const categoriesRef = useRef<HTMLDivElement>(null);

  useEffect(() => setTerm(q ?? ""), [q]);

  // Filtrado en vivo para "Solo por hoy" (muestra los activos del día y oculta los vencidos)
  const visibleListings = listings.filter((item: any) => {
    const now = new Date();
    if (item.expires_at && new Date(item.expires_at) <= now) {
      return false;
    }
    if (hoy) {
      return Boolean(item.is_flash_today);
    }
    return true;
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const value = term.trim();
    navigate({ search: (prev) => ({ ...prev, q: value || undefined }) });
  }

  function scrollCategoriesRight() {
    categoriesRef.current?.scrollBy({ left: 220, behavior: "smooth" });
  }

  return (
    <div>
      <section className="bg-hero text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 pb-14 pt-10 sm:pt-14">
          <h1 className="max-w-2xl text-3xl font-extrabold leading-[1.08] sm:text-5xl">
            Los negocios de Lavalle <span className="text-highlight">en un solo lugar.</span>
          </h1>
          <p className="mt-3 max-w-xl text-primary-foreground/80">
            Comprá y vendé entre vecinos. Sin vueltas: hablás directo con quien vende.
          </p>
          <form onSubmit={submit} className="mt-7 flex max-w-2xl gap-2 rounded-2xl bg-card p-2 shadow-lg">
            <label htmlFor="search" className="sr-only">
              Buscar productos y servicios
            </label>
            <div className="flex flex-1 items-center gap-2 px-3 text-muted-foreground">
              <Search className="size-5 shrink-0" />
              <input
                id="search"
                type="search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Buscar productos, servicios, negocios…"
                className="h-11 w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Button type="submit" size="lg" className="h-11 rounded-xl">
              Buscar
            </Button>
          </form>
        </div>
      </section>

      <section className="mx-auto -mt-6 max-w-6xl px-4">
        <div className="relative flex items-center gap-1.5">
          <div
            ref={categoriesRef}
            className="flex flex-1 gap-2 overflow-x-auto pb-2 pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <CategoryChip active={!cat && !hoy} label="Todas" icon={LayoutGrid} search={{ q, cat: undefined, hoy: undefined }} />
            <CategoryChip
              active={Boolean(hoy)}
              label="Solo por hoy"
              icon={Flame}
              search={{ q, cat: undefined, hoy: true }}
              highlight
            />
            {CATEGORIES.map((c) => (
              <CategoryChip
                key={c.slug}
                active={cat === c.slug && !hoy}
                label={c.label}
                icon={c.icon}
                search={{ q, cat: c.slug, hoy: undefined }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={scrollCategoriesRight}
            aria-label="Deslizar categorías hacia la derecha"
            title="Más categorías"
            className="mb-2 flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-card text-primary shadow-md transition-transform hover:scale-105 active:scale-95"
          >
            <ChevronRight className="size-5 animate-pulse" />
          </button>
        </div>
        <p className="mt-0.5 flex items-center justify-end gap-1 text-xs font-medium text-muted-foreground sm:hidden">
          Deslizá o tocá la flecha para ver más categorías <ChevronRight className="size-3.5 text-primary" />
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          <div className="min-w-0 flex-1">
            <div className="mb-5 flex items-baseline justify-between gap-4">
              <h2 className="text-2xl font-bold">
                {hoy ? "⚡ Solo por hoy (usados y ocasionales)" : cat ? categoryLabel(cat) : "Publicaciones recientes"}
                {q && <span className="font-sans text-base font-normal text-muted-foreground"> · “{q}”</span>}
              </h2>
              <span className="shrink-0 text-sm text-muted-foreground">
                {visibleListings.length} {visibleListings.length === 1 ? "aviso" : "avisos"}
              </span>
            </div>

            {visibleListings.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
                <PackageSearch className="size-10 text-muted-foreground" />
                <p className="font-display text-lg font-bold">
                  {hoy ? "No hay publicaciones de Solo por hoy en este momento" : "No encontramos avisos"}
                </p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {hoy
                    ? "¿Tenés algo usado o para vender hoy sin suscribirte? Publicalo en Solo por hoy (dura hasta el final del día)."
                    : "Probá con otra búsqueda o categoría. ¿Tenés algo para vender? Publicalo gratis."}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button asChild variant="outline">
                    <Link to="/comprar" search={{}}>
                      Ver todo
                    </Link>
                  </Button>
                  <Button asChild variant="cta">
                    <Link to="/publicar">Publicar venta</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
                {visibleListings.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            )}
          </div>

          <UsefulContacts />
        </div>
      </section>
    </div>
  );
}

function CategoryChip({
  active,
  label,
  icon: Icon,
  search,
  highlight = false,
}: {
  active: boolean;
  label: string;
  icon: ComponentType<{ className?: string }>;
  search: HomeSearch;
  highlight?: boolean;
}) {
  return (
    <Link
      to="/comprar"
      search={search}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium shadow-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : highlight
            ? "border-amber-500/50 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200"
            : "bg-card text-foreground hover:border-primary/40 hover:bg-primary-soft",
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}
