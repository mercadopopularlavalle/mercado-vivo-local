import { useState, type ChangeEvent, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  Check,
  Eye,
  ImageOff,
  ImagePlus,
  Loader2,
  Lock,
  MapPin,
  Package,
  PackagePlus,
  Pause,
  Pencil,
  Play,
  Save,
  Store,
  Trash2,
  Upload,
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
import { CATEGORIES, CATEGORY_SLUGS, categoryLabel } from "@/lib/categories";
import { formatPrice, isValidWhatsapp, normalizeWhatsapp } from "@/lib/format";
import { isStoragePath, LISTING_BUCKET } from "@/lib/listing-images";
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

export const Route = createFileRoute("/_authenticated/mis-publicaciones")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(myListingsQuery(context.user.id)),
      context.queryClient.ensureQueryData(myProfileQuery(context.user.id)),
      context.queryClient.ensureQueryData(appSettingsQuery()),
    ]),
  head: () => ({
    meta: [
      { title: "Administrar mi Tienda â€” Mercado Popular" },
      { name: "description", content: "AdministrÃ¡ los datos de tu comercio y el inventario de productos en Mercado Popular." },
      { property: "og:title", content: "Administrar mi Tienda â€” Mercado Popular" },
      { property: "og:description", content: "AdministrÃ¡ los datos de tu local e inventario de productos." },
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
  const storeActive = profile?.is_active ?? false;
  const storeName = profile?.store_name || "Mi Tienda";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      {!storeActive && (
        <div className="mb-8">
          <InactiveStoreBanner profile={profile} email={user.email ?? ""} />
        </div>
      )}

      {/* Cabecera del Panel */}
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
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold sm:text-3xl">{storeName}</h1>
              {storeActive ? (
                <ActiveSubscriptionBadge />
              ) : (
                <Badge variant="destructive">Tienda Pausada</Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Panel de AdministraciÃ³n de tu Comercio Â· {listings.length} {listings.length === 1 ? "artÃ­culo" : "artÃ­culos"} en catálogo
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {profile?.whatsapp && (
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <a
                href={`https://wa.me/${profile.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Probar WhatsApp de la tienda
              </a>
            </Button>
          )}
          <Button asChild variant="soft" size="sm" className="rounded-xl">
            <Link to="/" search={{ q: storeName }}>
              Ver mi tienda en vivo
            </Link>
          </Button>
        </div>
      </div>

      {/* Pestañas Principales: Datos del Local & Inventario */}
      <Tabs defaultValue="inventario" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="inventario" className="flex items-center gap-2">
            <Package className="size-4" /> Inventario
          </TabsTrigger>
          <TabsTrigger value="local" className="flex items-center gap-2">
            <Building2 className="size-4" /> Datos de mi Local
          </TabsTrigger>
        </TabsList>

        {/* PESTAÑA 1: INVENTARIO */}
        <TabsContent value="inventario" className="space-y-6">
          <InventoryTab listings={listings} userId={user.id} storeActive={storeActive} defaultLocation={profile?.city || "Local"} />
        </TabsContent>

        {/* PESTAÑA 2: DATOS DE MI LOCAL */}
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

  // Inicializar o sincronizar el estado editado
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

  // Guardar cambios masivos en precio o stock
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

  // Guardar una fila individual
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
      {/* Barra de acciones de inventario */}
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

      {/* Tabla limpia de inventario */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Package className="size-12 text-muted-foreground/60" />
            <h3 className="mt-4 text-lg font-bold">Tu inventario estÃ¡ vacÃ­o</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              ComenzÃ¡ agregando los productos de tu comercio para que los vecinos los encuentren.
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
                <TableHead className="w-32">CategorÃ­a</TableHead>
                <TableHead className="w-36">Precio (ARS)</TableHead>
                <TableHead className="w-32">Stock</TableHead>
                <TableHead className="w-28 text-center">Estado</TableHead>
                <TableHead className="w-32 text-right">Acciones</TableHead>
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
                    {/* Foto */}
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

                    {/* Producto */}
                    <TableCell>
                      <div className="font-semibold text-foreground line-clamp-1">{item.title}</div>
                      <div className="text-xs text-muted-foreground">{item.location}</div>
                    </TableCell>

                    {/* Categoría */}
                    <TableCell>
                      <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                        {categoryLabel(item.category)}
                      </span>
                    </TableCell>

                    {/* Precio Editable */}
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

                    {/* Stock Editable */}
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

                    {/* Estado: Si stock === 0 => AGOTADO */}
                    <TableCell className="text-center">
                      {isOutOfStock ? (
                        <Badge variant="offer" className="bg-[#F97316] text-white">
                          Agotado
                        </Badge>
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

                    {/* Acciones */}
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
                        <DeleteListingDialog listingId={item.id} title={item.title} imagePath={item.imagePath} userId={userId} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* MODAL PARA AGREGAR NUEVO PRODUCTO AL INVENTARIO */}
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
   MODAL DE AGREGAR PRODUCTO (FOTO, NOMBRE, CATEGORÍA, PRECIO, STOCK)
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
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("hogar");

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

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
      toast.error("IngresÃ¡ un precio vÃ¡lido");
      return;
    }

    setBusy(true);
    try {
      let imagePath: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        imagePath = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from(LISTING_BUCKET)
          .upload(imagePath, file);
        if (uploadErr) throw uploadErr;
      }

      // Preparar la descripción inyectando el tag de stock
      const finalDesc = updateDescriptionWithStock(description, stock);
      const status = stock === 0 ? "paused" : "active";

      const { error: insertErr } = await supabase.from("listings").insert({
        user_id: userId,
        title,
        price: Math.round(price),
        category: category as any,
        location: defaultLocation || "Local",
        description: finalDesc,
        image_url: imagePath,
        status,
      });

      if (insertErr) throw insertErr;

      toast.success("Producto agregado al inventario");
      await queryClient.invalidateQueries({ queryKey: ["my-listings", userId] });
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
      onOpenChange(false);
      setFile(null);
      setPreview(null);
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
          <DialogTitle>Agregar producto al Inventario</DialogTitle>
          <DialogDescription>
            CompletÃ¡ los datos para publicarlo en la tienda de tu comercio.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAddProduct} className="space-y-4">
          {/* Subir Foto */}
          <div>
            <Label className="text-xs font-semibold">Foto del producto</Label>
            <div className="mt-1.5 flex items-center gap-4">
              <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-muted text-muted-foreground">
                {preview ? (
                  <img src={preview} alt="Vista previa" className="size-full object-cover" />
                ) : (
                  <ImagePlus className="size-8 opacity-60" />
                )}
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-input bg-card px-3.5 py-2 text-xs font-semibold shadow-sm hover:bg-accent">
                <Upload className="size-4" /> Seleccionar imagen
                <input type="file" accept="image/*" className="sr-only" onChange={onFileChange} />
              </label>
            </div>
          </div>

          {/* Nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="prod-title" className="text-xs font-semibold">
              Nombre del producto *
            </Label>
            <Input id="prod-title" name="title" placeholder="Ej: Zapatillas Urbanas, Pan Casero" required className="h-10" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Categoría */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">CategorÃ­a *</Label>
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

            {/* Precio */}
            <div className="space-y-1.5">
              <Label htmlFor="prod-price" className="text-xs font-semibold">
                Precio (ARS) *
              </Label>
              <Input id="prod-price" name="price" type="number" min={0} placeholder="1500" required className="h-10" />
            </div>
          </div>

          {/* Stock Inicial */}
          <div className="space-y-1.5">
            <Label htmlFor="prod-stock" className="text-xs font-semibold">
              Cantidad en stock *
            </Label>
            <Input id="prod-stock" name="stock" type="number" min={0} defaultValue={1} required className="h-10" />
            <p className="text-[11px] text-muted-foreground">
              Si colocÃ¡s 0, el producto figurarÃ¡ de inmediato como <strong>Agotado</strong>.
            </p>
          </div>

          {/* Descripción opcional */}
          <div className="space-y-1.5">
            <Label htmlFor="prod-desc" className="text-xs font-semibold">
              DescripciÃ³n breve
            </Label>
            <Input id="prod-desc" name="description" placeholder="Detalles, talle, caracterÃ­sticas..." className="h-10" />
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="cta" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Publicar e ingresar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================================
   PESTAÑA 2: DATOS DE MI LOCAL (NOMBRE, LOGO, WHATSAPP, UBICACIÓN)
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

  function onLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen");
      return;
    }
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  }

  async function handleSaveStoreData(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const store = String(form.get("store") ?? "").trim();
    const name = String(form.get("name") ?? "").trim();
    const whatsapp = String(form.get("whatsapp") ?? "").trim();
    const city = String(form.get("city") ?? "").trim();

    if (!name) {
      toast.error("IngresÃ¡ el nombre del titular o responsable");
      return;
    }
    if (whatsapp && !isValidWhatsapp(whatsapp)) {
      toast.error("WhatsApp invÃ¡lido: usÃ¡ cÃ³digo de paÃ­s, ej. 5491155550101");
      return;
    }

    setBusy(true);
    try {
      let logoUrl = profile?.logo_url || null;

      // Si subió un nuevo archivo de logo
      if (logoFile) {
        const ext = logoFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${userId}/logo_${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from(LISTING_BUCKET)
          .upload(path, logoFile, { upsert: true });
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
      toast.success("Â¡Datos del local guardados con Ã©xito!");
    } catch {
      toast.error("No pudimos guardar los datos del local");
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
          <h2 className="text-xl font-bold">ConfiguraciÃ³n de tu Comercio</h2>
          <p className="text-xs text-muted-foreground">
            Estos datos serÃ¡n visibles para los compradores en cada producto de tu tienda.
          </p>
        </div>
      </div>

      <form onSubmit={handleSaveStoreData} className="space-y-5">
        {/* Logo del Comercio */}
        <div>
          <Label className="text-xs font-semibold">Logo del Comercio</Label>
          <div className="mt-2 flex items-center gap-4">
            <div className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-dashed bg-muted">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="size-full object-cover" />
              ) : (
                <Store className="size-8 text-muted-foreground opacity-60" />
              )}
            </div>
            <div>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-input bg-card px-3.5 py-2 text-xs font-semibold shadow-sm hover:bg-accent">
                <Upload className="size-4" /> Subir logo o foto del local
                <input type="file" accept="image/*" className="sr-only" onChange={onLogoChange} />
              </label>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Recomendado: imagen cuadrada (PNG o JPG) de al menos 400x400 px.
              </p>
            </div>
          </div>
        </div>

        {/* Nombre de la Tienda / Local */}
        <div className="space-y-1.5">
          <Label htmlFor="store-name" className="text-xs font-semibold">
            Nombre del Local o Negocio *
          </Label>
          <Input
            id="store-name"
            name="store"
            defaultValue={profile?.store_name ?? ""}
            placeholder="Ej: PanaderÃ­a La UniÃ³n, FerreterÃ­a El Puente"
            required
            className="h-11"
          />
        </div>

        {/* WhatsApp */}
        <div className="space-y-1.5">
          <Label htmlFor="store-whatsapp" className="text-xs font-semibold">
            WhatsApp para pedidos de clientes *
          </Label>
          <Input
            id="store-whatsapp"
            name="whatsapp"
            defaultValue={profile?.whatsapp ?? ""}
            placeholder="5491155550101 (con cÃ³digo de paÃ­s)"
            required
            className="h-11"
          />
          <p className="text-[11px] text-muted-foreground">
            Los clientes harÃ¡n click en "Contactar por WhatsApp" y enviarÃ¡n el pedido directo a este nÃºmero.
          </p>
        </div>

        {/* Responsable */}
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

        {/* Ubicación / Ciudad */}
        <div className="space-y-1.5">
          <Label htmlFor="store-city" className="text-xs font-semibold">
            Ciudad / UbicaciÃ³n del local
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
          <Button type="submit" variant="cta" size="lg" className="h-11 w-full sm:w-auto" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
            Guardar datos del local
          </Button>
        </div>
      </form>
    </div>
  );
}

/* =========================================================================
   DIÁLOGO DE ELIMINACIÓN
   ========================================================================= */

function DeleteListingDialog({
  listingId,
  title,
  imagePath,
  userId,
}: {
  listingId: string;
  title: string;
  imagePath: string | null;
  userId: string;
}) {
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("listings").delete().eq("id", listingId);
      if (error) throw error;
      if (isStoragePath(imagePath)) {
        await supabase.storage.from(LISTING_BUCKET).remove([imagePath]);
      }
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
          <AlertDialogTitle>Â¿Eliminar este producto?</AlertDialogTitle>
          <AlertDialogDescription>
            â€œ{title}â€  se borrarÃ¡ permanentemente del inventario y del catÃ¡logo.
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
