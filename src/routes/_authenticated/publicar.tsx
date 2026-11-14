import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ImagePlus, Loader2, X } from "lucide-react";
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
import { LISTING_BUCKET } from "@/lib/listing-images";
import { appSettingsQuery, myProfileQuery, saveMyProfile } from "@/lib/my-data";
import { InactiveStoreBanner } from "@/components/SubscriptionStatus";

export const Route = createFileRoute("/_authenticated/publicar")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(myProfileQuery(context.user.id)),
      context.queryClient.ensureQueryData(appSettingsQuery()),
    ]),
  head: () => ({
    meta: [
      { title: "Publicar venta — Mercado Popular" },
      { name: "description", content: "Publicá gratis lo que querés vender en Mercado Popular." },
      { property: "og:title", content: "Publicar venta — Mercado Popular" },
      { property: "og:description", content: "Publicá gratis lo que querés vender." },
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

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function PublishPage() {
  const { user } = Route.useRouteContext();
  const { data: profile } = useSuspenseQuery(myProfileQuery(user.id));
  if (!profile?.is_active) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <h1 className="mb-6 text-3xl font-extrabold sm:text-4xl">Publicar venta</h1>
        <InactiveStoreBanner profile={profile} email={user.email ?? ""} />
      </div>
    );
  }
  return <PublishForm />;
}

function PublishForm() {
  const { user } = Route.useRouteContext();
  const { data: profile } = useSuspenseQuery(myProfileQuery(user.id));
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [category, setCategory] = useState<string>("");
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp ?? "");
  const [location, setLocation] = useState(profile?.city ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen");
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      toast.error("La foto no puede superar los 5 MB");
      return;
    }
    setFile(f);
  }

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
      toast.error("Ingresá un WhatsApp válido con código de país, por ejemplo 5491155550101");
      return;
    }

    setBusy(true);
    try {
      const phone = normalizeWhatsapp(whatsapp);
      if (phone !== profile?.whatsapp || (!profile?.city && location)) {
        await saveMyProfile(user.id, { whatsapp: phone, city: profile?.city || location });
      }

      let imagePath: string | null = null;
      if (file) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        imagePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(LISTING_BUCKET)
          .upload(imagePath, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
      }

      const { data: created, error } = await supabase
        .from("listings")
        .insert({ ...parsed.data, user_id: user.id, image_url: imagePath })
        .select("id")
        .single();
      if (error) throw error;

      await queryClient.invalidateQueries();
      toast.success("¡Tu aviso ya está publicado!");
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
      <p className="mt-2 text-muted-foreground">Contá qué vendés. Los interesados te van a escribir por WhatsApp.</p>

      <form onSubmit={submit} className="mt-8 space-y-6">
        <div className="rounded-3xl border bg-card p-6 sm:p-8">
          <Label className="text-base font-semibold">Foto</Label>
          {preview ? (
            <div className="relative mt-3 overflow-hidden rounded-2xl border">
              <img src={preview} alt="Vista previa" className="aspect-[4/3] w-full object-cover" />
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute right-3 top-3 rounded-full"
                onClick={() => setFile(null)}
                aria-label="Quitar foto"
              >
                <X />
              </Button>
            </div>
          ) : (
            <label className="mt-3 flex aspect-[16/7] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-muted/50 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary-soft">
              <ImagePlus className="size-8" />
              <span className="text-sm font-medium">Subí una foto (hasta 5 MB)</span>
              <input type="file" accept="image/*" className="sr-only" onChange={onFile} />
            </label>
          )}
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
              placeholder="Ej: Caballito, CABA"
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" name="description" rows={6} maxLength={5000} placeholder="Estado, medidas, forma de entrega, horarios…" />
          </div>
        </div>

        <div className="space-y-1.5 rounded-3xl border bg-card p-6 sm:p-8">
          <Label htmlFor="whatsapp" className="text-base font-semibold">Tu WhatsApp</Label>
          <p className="text-sm text-muted-foreground">
            Se guarda en tu perfil y se usa en todos tus avisos. Con código de país y sin espacios, por ejemplo 5491155550101.
          </p>
          <Input
            id="whatsapp"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            required
            inputMode="tel"
            placeholder="5491155550101"
            className="mt-2 h-11"
          />
        </div>

        <Button type="submit" variant="cta" size="xl" className="w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          Publicar venta
        </Button>
      </form>
    </div>
  );
}
