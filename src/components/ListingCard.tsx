import { Link } from "@tanstack/react-router";
import { ImageOff, MapPin } from "lucide-react";
import { categoryLabel } from "@/lib/categories";
import { formatPrice } from "@/lib/format";
import type { ListingSummary } from "@/lib/listings.functions";

export function ListingCard({ listing }: { listing: ListingSummary }) {
  return (
    <Link
      to="/aviso/$id"
      params={{ id: listing.id }}
      className="group card-lift flex flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.title}
            loading="lazy"
            width={944}
            height={720}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <ImageOff className="size-8" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur">
          {categoryLabel(listing.category)}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="font-display text-2xl font-bold tracking-tight text-foreground">
          {formatPrice(listing.price)}
        </p>
        <h3 className="line-clamp-2 font-sans text-sm font-medium leading-snug tracking-normal text-foreground/85">
          {listing.title}
        </h3>
        <p className="mt-auto flex items-center gap-1 pt-2 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{listing.location}</span>
        </p>
      </div>
    </Link>
  );
}
