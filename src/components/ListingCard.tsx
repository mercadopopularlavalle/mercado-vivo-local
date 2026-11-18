import { useState, type MouseEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ImageOff, MapPin } from "lucide-react";
import { toast } from "sonner";
import { categoryLabel } from "@/lib/categories";
import { formatPrice } from "@/lib/format";
import type { ListingSummary } from "@/lib/listings.functions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export type SavedFavoriteItem = {
  id: string;
  title: string;
  price: number;
  imageUrl?: string | null;
  location?: string;
};

export function ListingCard({ listing }: { listing: ListingSummary }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const rawFavorites = Array.isArray(user?.user_metadata?.favorites)
    ? (user.user_metadata.favorites as SavedFavoriteItem[])
    : [];
  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
  const isLiked =
    optimisticLiked !== null
      ? optimisticLiked
      : rawFavorites.some((item) => item.id === listing.id);

  async function handleToggleLike(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast.info("Registrate como comprador para guardar tus 'Esto me gusta'");
      navigate({
        to: "/auth",
        search: { role: "buyer", redirect: window.location.pathname + window.location.search },
      });
      return;
    }

    if (busy) return;
    setBusy(true);
    const nextLiked = !isLiked;
    setOptimisticLiked(nextLiked);

    try {
      const currentList = Array.isArray(user.user_metadata?.favorites)
        ? (user.user_metadata.favorites as SavedFavoriteItem[])
        : [];

      const updatedList = nextLiked
        ? [
            {
              id: listing.id,
              title: listing.title,
              price: listing.price,
              imageUrl: listing.imageUrl ?? null,
              location: listing.location,
            },
            ...currentList.filter((item) => item.id !== listing.id),
          ]
        : currentList.filter((item) => item.id !== listing.id);

      const { error } = await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          favorites: updatedList,
        },
      });

      if (error) throw error;

      toast.success(
        nextLiked
          ? "🤩 Agregado a tus 'Esto me gusta'"
          : "Quitado de tus 'Esto me gusta'",
      );
    } catch {
      setOptimisticLiked(!nextLiked);
      toast.error("No pudimos actualizar tu lista. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

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

        <button
          type="button"
          onClick={handleToggleLike}
          disabled={busy}
          title={isLiked ? "Quitar de Esto me gusta" : "Esto me gusta"}
          aria-label="Esto me gusta"
          className={`absolute right-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow-md backdrop-blur transition-transform active:scale-95 ${
            isLiked
              ? "bg-amber-400 text-amber-950 ring-2 ring-amber-500"
              : "bg-card/90 text-foreground hover:bg-card"
          }`}
        >
          <span className="text-base leading-none" role="img" aria-label="Carita con ojos de estrella">
            🤩
          </span>
          <span>{isLiked ? "¡Me gusta!" : "Esto me gusta"}</span>
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="font-display text-2xl font-bold tracking-tight text-foreground">
          {formatPrice(listing.price)}
        </p>
        <h3 className="line-clamp-2 font-sans text-sm font-medium leading-snug tracking-normal text-foreground/85">
          {listing.title}
        </h3>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{listing.location}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
