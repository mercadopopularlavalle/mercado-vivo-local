import { useEffect, useState, type ComponentType, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { LayoutGrid, PackageSearch, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/ListingCard";
import { CATEGORIES, categoryLabel, isCategorySlug, type CategorySlug } from "@/lib/categories";
import { listingsQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

type HomeSearch = { q?: string | undefined; cat?: CategorySlug | undefined };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): HomeSearch => ({
    q: typeof search["q"] === "string" && search["q"].trim() ? search["q"].trim() : undefined,
    cat: isCategorySlug(search["cat"]) ? search["cat"] : undefined,
  }),
  loaderDeps: ({ search }) => ({ q: search.q, cat: search.cat }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(listingsQuery(deps.q, deps.cat)),
  head: () => ({
    meta: [
      { title: "Mercado Popular — Clasificados y compraventa local" },
      {
        name: "description",
        content:
          "Comprá y vendé cerca tuyo: hogar, indumentaria, comidas, servicios, electrónica y vehículos. Contactá al vendedor por WhatsApp.",
      },
      { property: "og:title", content: "Mercado Popular — Clasificados y compraventa local" },
      {
        property: "og:description",
        content: "Comprá y vendé cerca tuyo y contactá al vendedor directo por WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { q, cat } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const { data: listings } = useSuspenseQuery(listingsQuery(q, cat));
  const [term, setTerm] = useState(q ?? "");

  useEffect(() => setTerm(q ?? ""), [q]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const value = term.trim();
    navigate({ search: (prev) => ({ ...prev, q: value || undefined }) });
  }

  return (
    <div>
      <section className="bg-hero text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 pb-14 pt-10 sm:pt-14">
          <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.05] sm:text-5xl">
            Lo que buscás, <span className="text-accent">a la vuelta de tu casa.</span>
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
                placeholder="Buscar productos, servicios, ciudades…"
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
        <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
          <CategoryChip active={!cat} label="Todas" icon={LayoutGrid} search={{ q, cat: undefined }} />
          {CATEGORIES.map((c) => (
            <CategoryChip
              key={c.slug}
              active={cat === c.slug}
              label={c.label}
              icon={c.icon}
              search={{ q, cat: c.slug }}
            />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-bold">
            {cat ? categoryLabel(cat) : "Publicaciones recientes"}
            {q && <span className="font-sans text-base font-normal text-muted-foreground"> · “{q}”</span>}
          </h2>
          <span className="shrink-0 text-sm text-muted-foreground">
            {listings.length} {listings.length === 1 ? "aviso" : "avisos"}
          </span>
        </div>

        {listings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
            <PackageSearch className="size-10 text-muted-foreground" />
            <p className="font-display text-lg font-bold">No encontramos avisos</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Probá con otra búsqueda o categoría. ¿Tenés algo para vender? Publicalo gratis.
            </p>
            <div className="mt-2 flex gap-2">
              <Button asChild variant="outline">
                <Link to="/" search={{}}>
                  Ver todo
                </Link>
              </Button>
              <Button asChild variant="accent">
                <Link to="/publicar">Publicar venta</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CategoryChip({
  active,
  label,
  icon: Icon,
  search,
}: {
  active: boolean;
  label: string;
  icon: ComponentType<{ className?: string }>;
  search: HomeSearch;
}) {
  return (
    <Link
      to="/"
      search={search}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium shadow-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card text-foreground hover:border-primary/40 hover:bg-primary-soft",
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}
