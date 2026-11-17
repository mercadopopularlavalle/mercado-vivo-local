import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Flame, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, CATEGORY_SLUGS } from "@/lib/categories";
import { isValidWhatsapp, normalizeWhatsapp } from "@/lib/format";
import { removeStoredPhotos, uploadListingPhotos, type PhotoSlot } from "@/lib/listing-photos";
import { ListingPhotosPicker } from "@/components/ListingPhotosPicker";
import { appSettingsQuery, myProfileQuery, saveMyProfile } from "@/lib/my-data";
import { InactiveStoreBanner } from "@/components/SubscriptionStatus";

function isFreePromoActive(): boolean {
  const deadline = new Date("2026-12-15T23:59:59-03:00");
  return new Date() <= deadline;
}

export const Route = createFileRoute("/_authenticated/publicar")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(myProfileQuery(context.user.id)),
      context.queryClient.ensureQueryData(appSettingsQuery()),
    ]),
  head: () => ({
    meta: [
      { title: "Publicar venta — Mercado Popular" },
      { name: "description", content: "Publicá lo que querés vender en Lavalle en Mercado Popular." },
      { property: "og:title", content: "Publicar venta — Mercado Popular" },
      { property: "og:description", content: "Publicá lo que querés vender en Lavalle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublishPage,
});

const listingSchema = z.object({
  title: z.string().trim().min(3, "El título debe tener al menos 3 caracteres").max(120, "Máximo 120 caracteres"),
  price: z.coerce.number({ invalid_type_error: "Ingresá un precio" }).min(0, "El precio no puede ser negativo").max(999999999999, "Precio demasiado alto"),
  category: z.enum(CATEGORY_SLUGS, { errorMap: () => ({ message: "Elegí una categoría" }) }),
  location: z.string().trim().min(2, "Indicá la ubicación").max(120),
  description: z.string().trim().max(5000, "Máximo 5000 caracteres"),
});

function PublishPage() {
  const { user } = Route.useRouteContext();
  const { data: profile } = useSuspenseQuery(myProfileQuery(user.id));
  const promoActive = isFreePromoActive();
  const hasSubscription = Boolean(profile?.is_active);
  const canPublishRegular = hasSubscription || promoActive;

  return (
    <PublishForm
      hasSubscription={hasSubscription}
      promoActive={promoActive}
      canPublishRegular={canPublishRegular}
    />
  );
}

function PublishForm({
  hasSubscription,
  promoActive,
  canPublishRegular,
}: {
  hasSubscription: boolean;
  promoActive: boolean;
  canPublishRegular: boolean;
}) {
  const { user } = Route.useRouteContext();
  const { data: profile } = useSuspenseQuery(myProfileQuery(user.id));
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [category, setCategory] = useState<string>("");
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp ?? "");
  const [location, setLocation] = useState(profile?.city ?? "Lavalle");
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [busy, setBusy] = useState(false);
  // Si no tiene suscripción y ya venció la promo, por defecto publica en "Solo por hoy"
  const [soloPorHoy, setSoloPorHoy] = useState(!canPublishRegular);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = listingSchema.safeParse({
      title: form.get("title"),
      price: form.get("price"),
      category,
      location,
      description: form.get("description") ?? "",
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revisá los datos");
      return;
    }
    if (!isValidWhatsapp(whatsapp)) {
      toast.error("Ingresá un WhatsApp válido con código de país, por ejemplo 5492615550101");
      return;
    }

    setBusy(true);
    try {
      const phone = normalizeWhatsapp(whatsapp);
      if (phone !== profile?.whatsapp || (!profile?.city && location)) {
        await saveMyProfile(user.id, { whatsapp: phone, city: profile?.city || location });
      }

      const { image_url, image_url_2, uploaded } = await uploadListingPhotos(user.id, photos);

      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const isFlash = !canPublishRegular ? true : soloPorHoy;

      const insertPayload: Record<string, any> = {
        ...parsed.data,
        user_id: user.id,
        image_url,
        image_url_2,
      };

      if (isFlash) {
        insertPayload.is_flash_today = true;
        insertPayload.expires_at = endOfDay.toISOString();
      }

      const { data: created, error } = await supabase
        .from("listings")
        .insert(insertPayload as any)
        .select("id")
        .single();
      if (error) {
        await removeStoredPhotos(uploaded);
        throw error;
      }

      await queryClient.invalidateQueries();
      toast.success(
        isFlash
          ? "¡Publicado en Solo por hoy! Estará visible hasta el final del día (23:59 hs)."
          : "¡Tu aviso ya está publicado!",
      );
      navigate({ to: "/aviso/$id", params: { id: created.id } });
    } catch (err) {
      console.error(err);
      toast.error("No pudimos publicar el aviso. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-extrabold sm:text-4xl">Publicar venta</h1>
      <p className="mt-2 text-muted-foreground">Contá qué vendés en Lavalle. Los interesados te van a escribir por WhatsApp.</p>

      {!hasSubscription && promoActive && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-50/90 p-4 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div className="text-sm">
            <p className="font-bold">¡Uso gratuito para nuevos vendedores hasta el 15 de diciembre!</p>
            <p className="mt-0.5 text-emerald-900/90 dark:text-emerald-200">
              Podés publicar tus ventas sin costo hasta el 15 de diciembre. Luego de esa fecha necesitarás suscribirte para publicaciones permanentes, o usar la opción gratuita <strong>"Solo por hoy"</strong>.
            </p>
          </div>
        </div>
      )}

      {!canPublishRegular && (
        <div className="mt-6 space-y-4">
          <InactiveStoreBanner profile={profile} email={user.email ?? ""} />
          <div className="rounded-2xl border border-amber-500/40 bg-amber-50/80 p-4 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="flex items-center gap-1.5 font-bold">
              <Flame className="size-4 text-amber-600" /> Modo gratuito activo: "Solo por hoy"
            </p>
            <p className="mt-1">
              Sin suscripción podés publicar artículos usados u ocasionales en la pestaña <strong>Solo por hoy</strong>. Tu aviso se eliminará automáticamente al terminar el día (23:59 hs).
            </p>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="mt-8 space-y-6">
        <div className="rounded-3xl border bg-card p-6 sm:p-8">
          <Label className="text-base font-semibold">Fotos</Label>
          <div className="mt-3">
            <ListingPhotosPicker photos={photos} onChange={setPhotos} onBusyChange={setOptimizing} disabled={busy} />
          </div>
        </div>

        <div className="space-y-5 rounded-3xl border bg-card p-6 sm:p-8">
          <div className="space-y-1.5">
            <Label htmlFor="title">Título</Label>
            <Input id="title" name="title" required maxLength={120} placeholder="Ej: Bicicleta rodado 29 casi nueva" className="h-11" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="price">Precio (ARS)</Label>
              <Input id="price" name="price" type="number" inputMode="numeric" min={0} step="1" required placeholder="0" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">Categoría</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category" className="h-11">
                  <SelectValue placeholder="Elegí una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location">Ubicación</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
              maxLength={120}
              placeholder="Ej: Lavalle, Mendoza"
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" name="description" rows={6} maxLength={5000} placeholder="Estado, medidas, forma de entrega, horarios…" />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-50/70 p-4 text-sm dark:bg-amber-950/30">
            <input
              type="checkbox"
              checked={!canPublishRegular ? true : soloPorHoy}
              disabled={!canPublishRegular}
              onChange={(e) => setSoloPorHoy(e.target.checked)}
              className="mt-0.5 size-4 accent-amber-600"
            />
            <div>
              <span className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                <Flame className="size-4 text-amber-600" /> Publicar en "Solo por hoy" (usados u ocasionales)
              </span>
              <span className="mt-0.5 block text-xs text-amber-800/80 dark:text-amber-300/80">
                No requiere suscripción y se borra automáticamente al terminar el día (23:59 hs).
              </span>
            </div>
          </label>
        </div>

        <div className="space-y-1.5 rounded-3xl border bg-card p-6 sm:p-8">
          <Label htmlFor="whatsapp" className="text-base font-semibold">Tu WhatsApp</Label>
          <p className="text-sm text-muted-foreground">
            Se guarda en tu perfil y se usa en todos tus avisos. Con código de país y sin espacios, por ejemplo 5492615550101.
          </p>
          <Input
            id="whatsapp"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            required
            inputMode="tel"
            placeholder="5492615550101"
            className="mt-2 h-11"
          />
        </div>

        <Button type="submit" variant="cta" size="xl" className="w-full" disabled={busy || optimizing}>
          {(busy || optimizing) && <Loader2 className="animate-spin" />}
          {optimizing
            ? "Optimizando imagen..."
            : busy
              ? photos.some((p) => p.file)
                ? "Subiendo fotos..."
                : "Publicando..."
              : !canPublishRegular || soloPorHoy
                ? "Publicar en Solo por hoy"
                : "Publicar venta"}
        </Button>
      </form>
    </div>
  );
}
