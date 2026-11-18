import { useState, type ChangeEvent, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  Camera,
  Check,
  Eye,
  Flame,
  ImageOff,
  Loader2,
  Package,
  PackagePlus,
  Save,
  Sparkles,
  Store,
  Trash2,
  Upload,
  share2,
  sparkles,
  store,  
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActiveSubscriptionBadge, InactiveStoreBanner } from "@/components/SubscriptionStatus";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { isValidWhatsapp, normalizeWhatsapp } from "@/lib/format";
import { LISTING_BUCKET } from "@/lib/listing-images";
import { ImageOptimizeError, optimizeImage, extensionFor } from "@/lib/image-optimize";
import {
  removeStoredPhotos,
  slotsFromListing,
  uploadListingPhotos,
  type PhotoSlot,
} from "@/lib/listing-photos";
import { ListingPhotosPicker } from "@/components/ListingPhotosPicker";
import {
  appSettingsQuery,
  myListingsQuery,
  myProfileQuery,
  saveMyProfile,
  updateDescriptionWithStock,
  updateListingPriceAndStock,
  type MyListing,
} from "@/lib/my-data";
import { cn } from "@/lib/utils";

// Promoción lanzamiento: uso gratuito para nuevos vendedores hasta el 15 de diciembre
export function isFreePromoActive(): boolean {
  const deadline = new Date("2026-12-15T23:59:59-03:00");
  return new Date() <= deadline;
}

export const Route = createFileRoute("/_authenticated/mis-publicaciones")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(myListingsQuery(context.user.id)),
      context.queryClient.ensureQueryData(myProfileQuery(context.user.id)),
      context.queryClient.ensureQueryData(appSettingsQuery()),
    ]),
  head: () => ({
    meta: [
      { title: "Publicaciones de Vendedores y Mi Tienda — Mercado Popular" },
      { name: "description", content: "Administrá tus publicaciones de vendedor y los datos de Mi Tienda en Mercado Popular." },
      { property: "og:title", content: "Publicaciones de Vendedores — Mercado Popular" },
      { property: "og:description", content: "Administrá tus publicaciones y los datos de Mi Tienda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManageStorePage,
});

function ManageStorePage() {
  const { user } = Route.useRouteContext();
  const { data: listings } = useSuspenseQuery(myListingsQuery(user.id));
  const { data: profile } = useSuspenseQuery(myProfileQuery(user.id));
  const promoActive = isFreePromoActive();
  const hasSubscription = profile?.is_active ?? false;
  const storeActive = hasSubscription || promoActive;
  const storeName = profile?.store_name || "Mi Tienda";
  const [activeTab, setActiveTab] = useState("inventario");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      {!storeActive && (
        <div className="mb-8">
          <InactiveStoreBanner profile={profile} email={user.email ?? ""} />
        </div>
      )}

      {!hasSubscription && promoActive && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-50/90 p-4 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div className="text-sm">
            <p className="font-bold">¡Beneficio Lanzamiento en Lavalle!</p>
            <p className="mt-0.5 text-emerald-900/90 dark:text-emerald-200">
              Tenés uso <strong>100% gratuito</strong> para publicar tus ventas hasta el <strong>15 de diciembre</strong>. Luego de esa fecha podrás activar tu suscripción para continuar.
            </p>
          </div>
        </div>
      )}

      {/* Cabecera de Publicaciones de Vendedores con acceso directo a Mi Tienda */}
      <div className="mb-8 flex flex-col gap-4 rounded-3xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border bg-primary/10 text-primary">
            {profile?.logo_url ? (
              <img src={profile.logo_url} alt={storeName} className="size-full object-cover" />
            ) : (
              <Store className="size-8" />
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              Publicaciones de Vendedores
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold sm:text-3xl">{storeName}</h1>
              {hasSubscription ? (
                <ActiveSubscriptionBadge />
              ) : promoActive ? (
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Gratis hasta 15/12</Badge>
              ) : (
                <Badge variant="destructive">Suscripción vencida</Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {listings.length} {listings.length === 1 ? "publicación activa" : "publicaciones activas"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={activeTab === "local" ? "default" : "outline"}
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={() => setActiveTab("local")}
          >
            <Store className="size-4" />
            Mi Tienda
          </Button>
          {profile?.whatsapp && (
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <a
                href={`https://wa.me/${profile.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Probar WhatsApp
              </a>
            </Button>
          )}
          <Button asChild variant="soft" size="sm" className="rounded-xl">
            <Link to="/comprar" search={{ q: storeName }}>
              Ver mi tienda en vivo <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={() => {
              const storeUrl = `${window.location.origin}/comprar?q=${encodeURIComponent(storeName)}`;
              void navigator.clipboard.writeText(storeUrl);
              toast.success("¡Enlace de tu tienda copiado! Ya podés pegarlo en WhatsApp o redes.");
            }}
          >
            <Share2 className="size-4" />
            Compartir enlace de Mi Tienda
          </Button>
            </Link>
          </Button>
        </div>
      </div>

      {/* Pestañas dentro de Publicaciones de Vendedores: Mis Publicaciones & Mi Tienda */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="inventario" className="flex items-center gap-2">
            <Package className="size-4" /> Mis Publicaciones
          </TabsTrigger>
          <TabsTrigger value="local" className="flex items-center gap-2">
            <Building2 className="size-4" /> Mi Tienda
          </TabsTrigger>
        </TabsList>

        {/* PESTAÑA 1: PUBLICACIONES / INVENTARIO */}
        <TabsContent value="inventario" className="space-y-6">
          <InventoryTab listings={listings} userId={user.id} storeActive={storeActive} defaultLocation={profile?.city || "Lavalle"} />
        </TabsContent>

        {/* PESTAÑA 2: MI TIENDA (DATOS DEL LOCAL) */}
        <TabsContent value="local">
          <StoreProfileTab profile={profile} userId={user.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* =========================================================================
   PESTAÑA DE INVENTARIO (TABLA LIMPIA CON EDICIÓN DIRECTA)
   ========================================================================= */

type EditableItem = {
  price: number;
  stock: number;
};

function InventoryTab({
  listings,
  userId,
  storeActive,
  defaultLocation,
}: {
  listings: MyListing[];
  userId: string;
  storeActive: boolean;
  defaultLocation: string;
}) {
  const queryClient = useQueryClient();
  const [editedItems, setEditedItems] = useState<Record<string, EditableItem>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [openAddModal, setOpenAddModal] = useState(false);

  const getItemPrice = (id: string, orig: number) =>
    editedItems[id]?.price !== undefined ? editedItems[id].price : orig;
  const getItemStock = (id: string, orig: number) =>
    editedItems[id]?.stock !== undefined ? editedItems[id].stock : orig;

  const hasUnsavedChanges = Object.keys(editedItems).length > 0;

  function handlePriceChange(id: string, val: string, origStock: number) {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setEditedItems((prev) => ({
      ...prev,
      [id]: {
        price: num,
        stock: prev[id]?.stock !== undefined ? prev[id].stock : origStock,
      },
    }));
  }

  function handleStockChange(id: string, val: string, origPrice: number) {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setEditedItems((prev) => ({
      ...prev,
      [id]: {
        price: prev[id]?.price !== undefined ? prev[id].price : origPrice,
        stock: num,
      },
    }));
  }

  async function handleSaveAllChanges() {
    if (!hasUnsavedChanges) return;
    setIsSaving(true);
    try {
      const updates = Object.entries(editedItems).map(async ([id, changes]) => {
        const item = listings.find((l) => l.id === id);
        if (!item) return;
        await updateListingPriceAndStock(id, item.description, changes.price, changes.stock);
      });
      await Promise.all(updates);
      setEditedItems({});
      await queryClient.invalidateQueries({ queryKey: ["my-listings", userId] });
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.success("Inventario actualizado con éxito");
    } catch {
      toast.error("Hubo un error al guardar los cambios en el inventario");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveSingleRow(id: string) {
    const changes = editedItems[id];
    if (!changes) return;
    const item = listings.find((l) => l.id === id);
    if (!item) return;

    try {
      await updateListingPriceAndStock(id, item.description, changes.price, changes.stock);
      setEditedItems((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["my-listings", userId] });
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.success(`"${item.title}" actualizado`);
    } catch {
      toast.error("No pudimos actualizar el producto");
    }
  }

  const outOfStockCount = listings.filter((l) => getItemStock(l.id, l.stock) === 0).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {listings.length} productos registrados
          </span>
          {outOfStockCount > 0 && (
            <Badge variant="offer" className="gap-1">
              <AlertCircle className="size-3" /> {outOfStockCount} agotados
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {hasUnsavedChanges && (
            <Button
              onClick={handleSaveAllChanges}
              disabled={isSaving}
              variant="cta"
              className="gap-2 shadow-sm animate-pulse"
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Guardar cambios ({Object.keys(editedItems).length})
            </Button>
          )}

          <Button
            onClick={() => setOpenAddModal(true)}
            disabled={!storeActive}
            className="gap-2 rounded-xl"
          >
            <PackagePlus className="size-4" /> Agregar producto
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Package className="size-12 text-muted-foreground/60" />
            <h3 className="mt-4 text-lg font-bold">Tu lista de publicaciones está vacía</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Comenzá agregando los productos de tu comercio para que los vecinos de Lavalle los encuentren.
            </p>
            <Button
              onClick={() => setOpenAddModal(true)}
              disabled={!storeActive}
              className="mt-5 gap-2"
            >
              <PackagePlus className="size-4" /> Cargar primer producto
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-16">Foto</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="w-32">Categoría</TableHead>
                <TableHead className="w-36">Precio (ARS)</TableHead>
                <TableHead className="w-32">Stock</TableHead>
                <TableHead className="w-28 text-center">Estado</TableHead>
                <TableHead className="w-40 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listings.map((item) => {
                const currentPrice = getItemPrice(item.id, item.price);
                const currentStock = getItemStock(item.id, item.stock);
                const isOutOfStock = currentStock === 0;
                const isRowModified = !!editedItems[item.id];
                const isPaused = item.status === "paused" && !isOutOfStock;

                return (
                  <TableRow
                    key={item.id}
                    className={cn(
                      "transition-colors",
                      isRowModified && "bg-primary-soft/30",
                      isOutOfStock && "bg-destructive/5",
                    )}
                  >
                    <TableCell>
                      <div className="size-12 overflow-hidden rounded-xl bg-muted">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="size-full object-cover"
                          />
                        ) : (
                          <div className="grid size-full place-items-center text-muted-foreground">
                            <ImageOff className="size-5" />
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="font-semibold text-foreground line-clamp-1">{item.title}</div>
                      <div className="text-xs text-muted-foreground">{item.location}</div>
                    </TableCell>

                    <TableCell>
                      <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                        {categoryLabel(item.category)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-muted-foreground">$</span>
                        <Input
                          type="number"
                          min={0}
                          step="1"
                          value={currentPrice}
                          onChange={(e) => handlePriceChange(item.id, e.target.value, item.stock)}
                          className="h-9 w-28 text-sm font-semibold"
                        />
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          step="1"
                          value={currentStock}
                          onChange={(e) => handleStockChange(item.id, e.target.value, item.price)}
                          className={cn(
                            "h-9 w-20 text-sm font-bold text-center",
                            isOutOfStock && "border-destructive text-destructive font-black",
                          )}
                        />
                        <span className="text-xs text-muted-foreground">u.</span>
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      {isOutOfStock ? (
                        <Badge variant="offer">Agotado</Badge>
                      ) : isPaused ? (
                        <Badge variant="outline" className="text-muted-foreground">
                          Pausado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-50">
                          En stock
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isRowModified && (
                          <Button
                            size="icon"
                            variant="cta"
                            className="size-8"
                            onClick={() => handleSaveSingleRow(item.id)}
                            title="Guardar esta fila"
                          >
                            <Check className="size-4" />
                          </Button>
                        )}
                        <Button asChild size="icon" variant="ghost" className="size-8">
                          <Link to="/aviso/$id" params={{ id: item.id }} title="Ver aviso">
                            <Eye className="size-4" />
                          </Link>
                        </Button>
                        <EditPhotosDialog listing={item} userId={userId} disabled={!storeActive} />
                        <DeleteListingDialog listingId={item.id} title={item.title} imagePaths={item.imagePaths} userId={userId} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <AddProductModal
        open={openAddModal}
        onOpenChange={setOpenAddModal}
        userId={userId}
        defaultLocation={defaultLocation}
      />
    </div>
  );
}

/* =========================================================================
   MODAL DE AGREGAR PRODUCTO (INCLUYE OPCIÓN "SOLO POR HOY")
   ========================================================================= */

function AddProductModal({
  open,
  onOpenChange,
  userId,
  defaultLocation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  defaultLocation: string;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [category, setCategory] = useState<string>("hogar");
  const [soloPorHoy, setSoloPorHoy] = useState(false);

  async function handleAddProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const price = Number(form.get("price"));
    const stock = Number(form.get("stock") || 1);
    const description = String(form.get("description") ?? "").trim();

    if (!title || title.length < 3) {
      toast.error("El nombre del producto debe tener al menos 3 caracteres");
      return;
    }
    if (isNaN(price) || price < 0) {
      toast.error("Ingresá un precio válido");
      return;
    }

    setBusy(true);
    try {
      const { image_url, image_url_2, uploaded } = await uploadListingPhotos(userId, photos);

      const finalDesc = updateDescriptionWithStock(description, stock);
      const status = stock === 0 ? "paused" : "active";

      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const payload: Record<string, any> = {
        user_id: userId,
        title,
        price: Math.round(price),
        category: category as any,
        location: defaultLocation || "Lavalle",
        description: finalDesc,
        image_url,
        image_url_2,
        status,
      };

      if (soloPorHoy) {
        payload["is_flash_today"] = true;
        payload["expires_at"] = endOfDay.toISOString();
      }

      const { error: insertErr } = await supabase.from("listings").insert(payload as any);

      if (insertErr) {
        await removeStoredPhotos(uploaded);
        throw insertErr;
      }

      toast.success(
        soloPorHoy
          ? "Publicado en Solo por hoy (se borrará al terminar el día)"
          : "Producto agregado a tus publicaciones",
      );
      await queryClient.invalidateQueries({ queryKey: ["my-listings", userId] });
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
      onOpenChange(false);
      setPhotos([]);
      setSoloPorHoy(false);
    } catch {
      toast.error("No se pudo agregar el producto");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar producto</DialogTitle>
          <DialogDescription>
            Completá los datos para publicarlo en Mercado Popular.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAddProduct} className="space-y-4">
          <div>
            <Label className="text-xs font-semibold">Fotos del producto</Label>
            <div className="mt-1.5">
              <ListingPhotosPicker photos={photos} onChange={setPhotos} onBusyChange={setOptimizing} disabled={busy} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prod-title" className="text-xs font-semibold">
              Nombre del producto *
            </Label>
            <Input id="prod-title" name="title" placeholder="Ej: Caña de pescar, Pan Casero" required className="h-10" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Categoría *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.slug} value={cat.slug}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-price" className="text-xs font-semibold">
                Precio (ARS) *
              </Label>
              <Input id="prod-price" name="price" type="number" min={0} placeholder="1500" required className="h-10" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prod-stock" className="text-xs font-semibold">
              Cantidad en stock *
            </Label>
            <Input id="prod-stock" name="stock" type="number" min={0} defaultValue={1} required className="h-10" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prod-desc" className="text-xs font-semibold">
              Descripción breve
            </Label>
            <Input id="prod-desc" name="description" placeholder="Detalles, estado, talle..." className="h-10" />
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-50/70 p-3 text-xs dark:bg-amber-950/30">
            <input
              type="checkbox"
              checked={soloPorHoy}
              onChange={(e) => setSoloPorHoy(e.target.checked)}
              className="mt-0.5 size-4 accent-amber-600"
            />
            <div>
              <span className="flex items-center gap-1 font-bold text-amber-900 dark:text-amber-200">
                <Flame className="size-3.5 text-amber-600" /> Publicar en "Solo por hoy" (usados u ocasionales)
              </span>
              <span className="mt-0.5 block text-amber-800/80 dark:text-amber-300/80">
                No requiere suscripción y se elimina automáticamente al terminar el día (23:59 hs).
              </span>
            </div>
          </label>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="cta" disabled={busy || optimizing}>
              {(busy || optimizing) && <Loader2 className="size-4 animate-spin" />}
              {optimizing ? "Optimizando imagen..." : busy ? "Subiendo..." : "Publicar e ingresar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================================
   PESTAÑA 2: MI TIENDA (NOMBRE, LOGO, WHATSAPP, UBICACIÓN)
   ========================================================================= */

function StoreProfileTab({
  profile,
  userId,
}: {
  profile: any;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(profile?.logo_url || null);
  const [logoOptimizing, setLogoOptimizing] = useState(false);

  async function onLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setLogoOptimizing(true);
    try {
      const optimized = await optimizeImage(f);
      setLogoFile(optimized);
      setLogoPreview(URL.createObjectURL(optimized));
    } catch (err) {
      toast.error(err instanceof ImageOptimizeError ? err.message : "No pudimos optimizar la imagen");
    } finally {
      setLogoOptimizing(false);
    }
  }

  async function handleSaveStoreData(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const store = String(form.get("store") ?? "").trim();
    const name = String(form.get("name") ?? "").trim();
    const whatsapp = String(form.get("whatsapp") ?? "").trim();
    const city = String(form.get("city") ?? "").trim();

    if (!name) {
      toast.error("Ingresá el nombre del titular o responsable");
      return;
    }
    if (whatsapp && !isValidWhatsapp(whatsapp)) {
      toast.error("WhatsApp inválido: usá código de país, ej. 5492615550101");
      return;
    }

    setBusy(true);
    try {
      let logoUrl = profile?.logo_url || null;

      if (logoFile) {
        const path = `${userId}/logo_${Date.now()}.${extensionFor(logoFile)}`;
        const { error: uploadErr } = await supabase.storage
          .from(LISTING_BUCKET)
          .upload(path, logoFile, { upsert: true, contentType: logoFile.type });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from(LISTING_BUCKET).getPublicUrl(path);
          logoUrl = urlData.publicUrl;
        }
      }

      await saveMyProfile(userId, {
        store_name: store || null,
        display_name: name.slice(0, 80),
        whatsapp: whatsapp ? normalizeWhatsapp(whatsapp) : null,
        city: city || null,
        logo_url: logoUrl,
      });

      await queryClient.invalidateQueries({ queryKey: ["my-profile", userId] });
      toast.success("¡Datos de Mi Tienda guardados con éxito!");
    } catch {
      toast.error("No pudimos guardar los datos de Mi Tienda");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-secondary-foreground shadow-sm">
          <Store className="size-6" />
        </span>
        <div>
          <h2 className="text-xl font-bold">Mi Tienda — Configuración del Comercio</h2>
          <p className="text-xs text-muted-foreground">
            Estos datos serán visibles para los compradores en cada producto de tu tienda.
          </p>
        </div>
      </div>

      <form onSubmit={handleSaveStoreData} className="space-y-5">
        <div>
          <Label className="text-xs font-semibold">Logo del Comercio</Label>
          <div className="mt-2 flex items-center gap-4">
            <div className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-dashed bg-muted">
              {logoOptimizing ? (
                <Loader2 className="size-6 animate-spin text-primary" />
              ) : logoPreview ? (
                <img src={logoPreview} alt="Logo" className="size-full object-cover" />
              ) : (
                <Store className="size-8 text-muted-foreground opacity-60" />
              )}
            </div>
            <div>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-input bg-card px-3.5 py-2 text-xs font-semibold shadow-sm hover:bg-accent">
                <Upload className="size-4" /> {logoOptimizing ? "Optimizando imagen..." : "Subir logo o foto del local"}
                <input type="file" accept="image/*" className="sr-only" onChange={onLogoChange} disabled={logoOptimizing} />
              </label>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Recomendado: imagen cuadrada (PNG o JPG) de al menos 400x400 px.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="store-name" className="text-xs font-semibold">
            Nombre del Local o Negocio *
          </Label>
          <Input
            id="store-name"
            name="store"
            defaultValue={profile?.store_name ?? ""}
            placeholder="Ej: Panadería La Unión, Ferretería El Puente"
            required
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="store-whatsapp" className="text-xs font-semibold">
            WhatsApp para pedidos de clientes *
          </Label>
          <Input
            id="store-whatsapp"
            name="whatsapp"
            defaultValue={profile?.whatsapp ?? ""}
            placeholder="5492615550101 (con código de país)"
            required
            className="h-11"
          />
          <p className="text-[11px] text-muted-foreground">
            Los clientes harán click en "Contactar por WhatsApp" y enviarán el pedido directo a este número.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="store-owner" className="text-xs font-semibold">
            Nombre del titular o responsable *
          </Label>
          <Input
            id="store-owner"
            name="name"
            defaultValue={profile?.display_name ?? ""}
            placeholder="Tu nombre y apellido"
            required
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="store-city" className="text-xs font-semibold">
            Ciudad / Ubicación del local
          </Label>
          <Input
            id="store-city"
            name="city"
            defaultValue={profile?.city ?? ""}
            placeholder="Ej: Lavalle, Mendoza"
            className="h-11"
          />
        </div>

        <div className="pt-2">
          <Button type="submit" variant="cta" size="lg" className="h-11 w-full sm:w-auto" disabled={busy || logoOptimizing}>
            {busy ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
            Guardar datos de Mi Tienda
          </Button>
        </div>
      </form>
    </div>
  );
}

/* =========================================================================
   DIÁLOGO PARA CAMBIAR FOTOS (HASTA 2, OPTIMIZADAS)
   ========================================================================= */

function EditPhotosDialog({
  listing,
  userId,
  disabled,
}: {
  listing: MyListing;
  userId: string;
  disabled: boolean;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [busy, setBusy] = useState(false);

  function onOpenChange(next: boolean) {
    if (busy || optimizing) return;
    if (next) setPhotos(slotsFromListing(listing.imagePaths, listing.imageUrls));
    setOpen(next);
  }

  async function save() {
    setBusy(true);
    try {
      const { image_url, image_url_2, uploaded } = await uploadListingPhotos(userId, photos);
      const { error } = await supabase
        .from("listings")
        .update({ image_url, image_url_2 })
        .eq("id", listing.id);
      if (error) {
        await removeStoredPhotos(uploaded);
        throw error;
      }
      const stillUsed = new Set([image_url, image_url_2]);
      await removeStoredPhotos(listing.imagePaths.filter((p) => !stillUsed.has(p)));
      await queryClient.invalidateQueries({ queryKey: ["my-listings", userId] });
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
      await queryClient.invalidateQueries({ queryKey: ["listing", listing.id] });
      toast.success("Fotos actualizadas");
      setOpen(false);
    } catch {
      toast.error("No pudimos guardar las fotos. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs" disabled={disabled} title="Cambiar foto">
          <Camera className="size-4" />
          <span className="hidden xl:inline">Cambiar foto</span>
          <span className="sr-only xl:hidden">Cambiar foto</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cambiar foto</DialogTitle>
          <DialogDescription>“{listing.title}” · hasta 2 fotos. La primera es la portada.</DialogDescription>
        </DialogHeader>
        <ListingPhotosPicker photos={photos} onChange={setPhotos} onBusyChange={setOptimizing} disabled={busy} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy || optimizing}>
            Cancelar
          </Button>
          <Button type="button" variant="cta" onClick={save} disabled={busy || optimizing}>
            {(busy || optimizing) && <Loader2 className="size-4 animate-spin" />}
            {optimizing ? "Optimizando imagen..." : busy ? "Subiendo..." : "Guardar fotos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================================
   DIÁLOGO DE ELIMINACIÓN
   ========================================================================= */

function DeleteListingDialog({
  listingId,
  title,
  imagePaths,
  userId,
}: {
  listingId: string;
  title: string;
  imagePaths: Array<string | null>;
  userId: string;
}) {
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("listings").delete().eq("id", listingId);
      if (error) throw error;
      await removeStoredPhotos(imagePaths);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-listings", userId] });
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast.success("Producto eliminado del inventario");
    },
    onError: () => toast.error("No pudimos eliminar el producto"),
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar este producto?</AlertDialogTitle>
          <AlertDialogDescription>
            “{title}” se borrará permanentemente del inventario y del catálogo.
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
  );
}
