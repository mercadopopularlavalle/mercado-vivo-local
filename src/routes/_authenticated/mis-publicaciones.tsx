import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Eye, ImageOff, Lock, MapPin, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ActiveSubscriptionBadge, InactiveStoreBanner } from "@/components/SubscriptionStatus";
import { supabase } from "@/integrations/supabase/client";
import { categoryLabel } from "@/lib/categories";
import { formatPrice, isValidWhatsapp, normalizeWhatsapp } from "@/lib/format";
import { isStoragePath, LISTING_BUCKET } from "@/lib/listing-images";
import { appSettingsQuery, myListingsQuery, myProfileQuery, saveMyProfile, type MyListing } from "@/lib/my-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mis-publicaciones")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(myListingsQuery(context.user.id)),
      context.queryClient.ensureQueryData(myProfileQuery(context.user.id)),
      context.queryClient.ensureQueryData(appSettingsQuery()),
    ]),
  head: () => ({
    meta: [
      { title: "Mis publicaciones — Mercado Popular" },
      { name: "description", content: "Administrá tus avisos: pausalos, reactivalos o eliminalos." },
      { property: "og:title", content: "Mis publicaciones — Mercado Popular" },
      { property: "og:description", content: "Administrá tus avisos en Mercado Popular." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyListingsPage,
});

function MyListingsPage() {
  const { user } = Route.useRouteContext();
  const { data: listings } = useSuspenseQuery(myListingsQuery(user.id));
  const { data: profile } = useSuspenseQuery(myProfileQuery(user.id));
  const storeActive = profile?.is_active ?? false;
  const active = listings.filter((l) => l.status === "active").length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      {!storeActive && (
        <div className="mb-8">
          <InactiveStoreBanner profile={profile} email={user.email ?? ""} />
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {storeActive && (
            <div className="mb-3">
              <ActiveSubscriptionBadge />
            </div>
          )}
          <h1 className="text-3xl font-extrabold sm:text-4xl">Mis publicaciones</h1>
          <p className="mt-1 text-muted-foreground">
            {listings.length} {listings.length === 1 ? "aviso" : "avisos"} · {active} activos
          </p>
        </div>
        {storeActive ? (
          <Button asChild variant="cta" size="lg">
            <Link to="/publicar">
              <Plus /> Publicar venta
            </Link>
          </Button>
        ) : (
          <Button variant="cta" size="lg" disabled title="Activá tu suscripción para publicar">
            <Lock /> Publicar venta
          </Button>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          {listings.length === 0 ? (
            <div className="rounded-3xl border border-dashed bg-card px-6 py-14 text-center">
              <p className="font-display text-lg font-bold">Todavía no publicaste nada</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {storeActive
                  ? "Tu primer aviso está a un par de clics."
                  : "Cuando tu suscripción esté activa vas a poder publicar."}
              </p>
              {storeActive && (
                <Button asChild variant="cta" className="mt-4">
                  <Link to="/publicar">Publicar venta</Link>
                </Button>
              )}
            </div>
          ) : (
            listings.map((l) => <MyListingRow key={l.id} listing={l} userId={user.id} storeActive={storeActive} />)
          )}
        </div>
        <ProfileCard userId={user.id} />
      </div>
    </div>
  );
}

function MyListingRow({
  listing,
  userId,
  storeActive,
}: {
  listing: MyListing;
  userId: string;
  storeActive: boolean;
}) {
  const queryClient = useQueryClient();
  const paused = listing.status === "paused";

  const toggle = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("listings")
        .update({ status: paused ? "active" : "paused" })
        .eq("id", listing.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success(paused ? "Aviso reactivado" : "Aviso pausado");
    },
    onError: () => toast.error("No pudimos actualizar el aviso"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("listings").delete().eq("id", listing.id);
      if (error) throw error;
      if (isStoragePath(listing.imagePath)) {
        await supabase.storage.from(LISTING_BUCKET).remove([listing.imagePath]);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-listings", userId] });
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.success("Aviso eliminado");
    },
    onError: () => toast.error("No pudimos eliminar el aviso"),
  });

  return (
    <article
      className={cn(
        "flex gap-4 rounded-2xl border bg-card p-3 shadow-sm transition-opacity sm:p-4",
        paused && "opacity-75",
      )}
    >
      <div className="size-24 shrink-0 overflow-hidden rounded-xl bg-muted sm:size-28">
        {listing.imageUrl ? (
          <img src={listing.imageUrl} alt={listing.title} loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <ImageOff className="size-6" />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h2 className="line-clamp-2 font-sans text-base font-semibold tracking-normal">{listing.title}</h2>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
              paused ? "bg-muted text-muted-foreground" : "bg-success-soft text-success",
            )}
          >
            {paused ? "Pausado" : "Activo"}
          </span>
        </div>
        <p className="font-display text-lg font-bold">{formatPrice(listing.price)}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3.5" /> {listing.location} · {categoryLabel(listing.category)}
        </p>
        <div className="mt-auto flex flex-wrap gap-2 pt-3">
          {!paused && storeActive && (
            <Button asChild size="sm" variant="ghost">
              <Link to="/aviso/$id" params={{ id: listing.id }}>
                <Eye /> Ver
              </Link>
            </Button>
          )}
          <PriceEditor listing={listing} userId={userId} disabled={!storeActive} />
          <Button size="sm" variant="soft" onClick={() => toggle.mutate()} disabled={toggle.isPending}>
            {paused ? <Play /> : <Pause />}
            {paused ? "Reactivar" : "Pausar"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Trash2 /> Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar este aviso?</AlertDialogTitle>
                <AlertDialogDescription>
                  “{listing.title}” se borrará para siempre. Si solo querés ocultarlo por un tiempo, pausalo.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => remove.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </article>
  );
}

function PriceEditor({ listing, userId, disabled }: { listing: MyListing; userId: string; disabled: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(listing.price));

  const save = useMutation({
    mutationFn: async (price: number) => {
      const { error } = await supabase.from("listings").update({ price }).eq("id", listing.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-listings", userId] });
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
      await queryClient.invalidateQueries({ queryKey: ["listing", listing.id] });
      toast.success("Precio actualizado");
      setOpen(false);
    },
    onError: () => toast.error("No pudimos actualizar el precio"),
  });

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0 || price > 999999999999) {
      toast.error("Ingresá un precio válido");
      return;
    }
    save.mutate(Math.round(price));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setValue(String(listing.price));
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" disabled={disabled}>
          <Pencil /> Precio
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar precio</DialogTitle>
          <DialogDescription className="line-clamp-2">{listing.title}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`price-${listing.id}`}>Nuevo precio (ARS)</Label>
            <Input
              id={`price-${listing.id}`}
              type="number"
              inputMode="numeric"
              min={0}
              step="1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-11"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={save.isPending} className="w-full sm:w-auto">
              Guardar precio
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProfileCard({ userId }: { userId: string }) {
  const { data: profile } = useSuspenseQuery(myProfileQuery(userId));
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const store = String(form.get("store") ?? "").trim();
    const whatsapp = String(form.get("whatsapp") ?? "");
    const city = String(form.get("city") ?? "").trim();
    if (!name) {
      toast.error("Ingresá tu nombre");
      return;
    }
    if (whatsapp && !isValidWhatsapp(whatsapp)) {
      toast.error("WhatsApp inválido: usá código de país, ej. 5491155550101");
      return;
    }
    setBusy(true);
    try {
      await saveMyProfile(userId, {
        display_name: name.slice(0, 80),
        store_name: store ? store.slice(0, 80) : null,
        whatsapp: whatsapp ? normalizeWhatsapp(whatsapp) : null,
        city: city || null,
      });
      await queryClient.invalidateQueries();
      toast.success("Perfil guardado");
    } catch {
      toast.error("No pudimos guardar tu perfil");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="h-fit rounded-3xl border bg-card p-6 lg:sticky lg:top-24">
      <h2 className="text-lg font-bold">Tu perfil de vendedor</h2>
      <p className="mt-1 text-sm text-muted-foreground">Así te ven los compradores.</p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="p-name">Nombre</Label>
          <Input id="p-name" name="name" defaultValue={profile?.display_name ?? ""} maxLength={80} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-store">Nombre de la tienda (opcional)</Label>
          <Input id="p-store" name="store" defaultValue={profile?.store_name ?? ""} maxLength={80} placeholder="Ej: Almacén Don Pepe" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-wa">WhatsApp</Label>
          <Input id="p-wa" name="whatsapp" inputMode="tel" defaultValue={profile?.whatsapp ?? ""} placeholder="5491155550101" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-city">Ciudad</Label>
          <Input id="p-city" name="city" defaultValue={profile?.city ?? ""} maxLength={120} placeholder="Ej: Rosario, Santa Fe" />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          Guardar perfil
        </Button>
      </form>
    </aside>
  );
}
