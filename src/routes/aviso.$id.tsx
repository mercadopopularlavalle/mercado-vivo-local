import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, ImageOff, MapPin, MessageCircle, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { categoryLabel, isCategorySlug } from "@/lib/categories";
import { buildWhatsappLink, formatDate, formatPrice } from "@/lib/format";
import { listingQuery } from "@/lib/queries";
import { parseStockFromDescription } from "@/lib/my-data";

export const Route = createFileRoute("/aviso/$id")({
  loader: async ({ context, params }) => {
    const listing = await context.queryClient.ensureQueryData(listingQuery(params.id));
    if (!listing) throw notFound();
    return { title: listing.title, price: listing.price, location: listing.location };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Aviso no disponible — Mercado Popular" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${loaderData.title} — ${formatPrice(loaderData.price)} | Mercado Popular`;
    const description = `${loaderData.title} en ${loaderData.location}. Contactá al vendedor por WhatsApp en Mercado Popular.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ListingPage,
});

function ListingPage() {
  const { id } = Route.useParams();
  const { data: listing } = useSuspenseQuery(listingQuery(id));
  if (!listing) return null;

  const cat = isCategorySlug(listing.category) ? listing.category : undefined;
  const stock = parseStockFromDescription(listing.description);
  const cleanDescription = (listing.description ?? "").replace(/\[STOCK:\d+\]/gi, "").trim();
  const isOutOfStock = stock === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" search={{}} className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-4" /> Volver
        </Link>
        <span>·</span>
        <Link to="/" search={{ cat }} className="hover:text-foreground">
          {categoryLabel(listing.category)}
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
        <PhotoGallery urls={listing.imageUrls ?? (listing.imageUrl ? [listing.imageUrl] : [])} title={listing.title} />

        <aside className="flex flex-col gap-5">
          <div className="rounded-3xl border bg-card p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
                {categoryLabel(listing.category)}
              </span>
              {isOutOfStock ? (
                <span className="inline-flex rounded-full bg-[#F97316] px-3 py-1 text-xs font-bold text-white shadow-sm">
                  Agotado
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  En stock ({stock} u.)
                </span>
              )}
            </div>
            <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">{listing.title}</h1>
            <p className="mt-3 font-display text-4xl font-extrabold tracking-tight">
              {formatPrice(listing.price)}
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <MapPin className="size-4" /> {listing.location}
              </li>
              <li className="flex items-center gap-2">
                <CalendarDays className="size-4" /> Publicado el {formatDate(listing.createdAt)}
              </li>
            </ul>

            {listing.seller.whatsapp ? (
              <Button asChild variant="whatsapp" size="xl" className="mt-6 w-full">
                <a
                  href={buildWhatsappLink(listing.seller.whatsapp, listing.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle />
                  Contactar por WhatsApp
                </a>
              </Button>
            ) : (
              <p className="mt-6 rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                Este vendedor todavía no cargó su WhatsApp.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 rounded-3xl border bg-card p-5">
            <span className="grid size-11 place-items-center rounded-full bg-secondary text-secondary-foreground">
              <UserRound className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{listing.seller.store ? "Tienda" : "Vendedor"}</p>
              <p className="truncate font-semibold">{listing.seller.store ?? listing.seller.name}</p>
              {listing.seller.city && <p className="truncate text-xs text-muted-foreground">{listing.seller.city}</p>}
            </div>
          </div>

          <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            Consejo: encontrate en un lugar público y revisá el producto antes de pagar.
          </p>
        </aside>
      </div>

      <section className="mt-8 rounded-3xl border bg-card p-6 sm:p-8 lg:max-w-[calc(58%)]">
        <h2 className="text-xl font-bold">Descripción</h2>
        <p className="mt-3 whitespace-pre-line leading-relaxed text-foreground/85">
          {cleanDescription || "El vendedor no agregó una descripción."}
        </p>
      </section>
    </div>
  );
}

function PhotoGallery({ urls, title }: { urls: string[]; title: string }) {
  const [active, setActive] = useState(0);
  const current = urls[Math.min(active, urls.length - 1)];
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-3xl border bg-muted">
        {current ? (
          <img src={current} alt={title} width={944} height={720} className="aspect-[4/3] size-full object-cover" />
        ) : (
          <div className="grid aspect-[4/3] place-items-center text-muted-foreground">
            <ImageOff className="size-10" />
          </div>
        )}
      </div>
      {urls.length > 1 && (
        <div className="flex gap-3">
          {urls.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Ver foto ${i + 1}`}
              aria-pressed={i === active}
              className={`size-20 overflow-hidden rounded-2xl border-2 bg-muted transition-colors sm:size-24 ${
                i === active ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <img src={url} alt={`${title} — foto ${i + 1}`} loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
