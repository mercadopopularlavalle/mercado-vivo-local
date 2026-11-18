import { useState, type ChangeEvent } from "react";
import { Crop, ImagePlus, Loader2, Maximize2, Replace, RotateCw, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PhotoCropDialog } from "@/components/PhotoCropDialog";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import {
  cropImage,
  ImageOptimizeError,
  MAX_LISTING_PHOTOS,
  optimizeImage,
  rotateImage,
  type CropArea,
} from "@/lib/image-optimize";
import type { PhotoSlot } from "@/lib/listing-photos";
import { cn } from "@/lib/utils";

function errorText(err: unknown, fallback: string) {
  return err instanceof ImageOptimizeError ? err.message : fallback;
}

export function ListingPhotosPicker({
  photos,
  onChange,
  onBusyChange,
  disabled,
}: {
  photos: PhotoSlot[];
  onChange: (photos: PhotoSlot[]) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const [optimizing, setOptimizing] = useState(0);
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [cropKey, setCropKey] = useState<string | null>(null);
  const cropSlot = photos.find((p) => p.key === cropKey) ?? null;
  const remaining = MAX_LISTING_PHOTOS - photos.length;
  const locked = disabled || optimizing > 0 || workingKey !== null;

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    if (files.length > remaining) {
      toast.error(`Podés subir hasta ${MAX_LISTING_PHOTOS} fotos por publicación`);
    }
    const chosen = files.slice(0, Math.max(0, remaining));
    if (chosen.length === 0) return;

    setOptimizing(chosen.length);
    onBusyChange?.(true);
    const added: PhotoSlot[] = [];
    for (const f of chosen) {
      try {
        const optimized = await optimizeImage(f);
        added.push({ key: crypto.randomUUID(), previewUrl: URL.createObjectURL(optimized), file: optimized });
      } catch (err) {
        toast.error(errorText(err, "No pudimos optimizar la foto"));
      }
    }
    setOptimizing(0);
    onBusyChange?.(false);
    if (added.length) onChange([...photos, ...added].slice(0, MAX_LISTING_PHOTOS));
  }

  /** Swaps one slot for a new optimized file, keeping its position. */
  async function updateSlot(key: string, produce: (slot: PhotoSlot) => Promise<File>, failMsg: string) {
    const slot = photos.find((p) => p.key === key);
    if (!slot) return;
    setWorkingKey(key);
    onBusyChange?.(true);
    try {
      const file = await produce(slot);
      if (slot.file) URL.revokeObjectURL(slot.previewUrl);
      onChange(
        photos.map((p) =>
          p.key === key ? { key: crypto.randomUUID(), previewUrl: URL.createObjectURL(file), file } : p,
        ),
      );
    } catch (err) {
      toast.error(errorText(err, failMsg));
    } finally {
      setWorkingKey(null);
      onBusyChange?.(false);
    }
  }

  function replace(key: string, e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    void updateSlot(key, () => optimizeImage(f), "No pudimos optimizar la foto");
  }

  const sourceOf = async (slot: PhotoSlot) => slot.file ?? (await (await fetch(slot.previewUrl)).blob());

  function rotate(key: string) {
    void updateSlot(key, async (slot) => rotateImage(await sourceOf(slot)), "No pudimos girar la foto");
  }

  async function applyCrop(area: CropArea) {
    if (!cropKey) return;
    await updateSlot(cropKey, async (slot) => cropImage(await sourceOf(slot), area), "No pudimos recortar la foto");
  }

  function remove(key: string) {
    const slot = photos.find((p) => p.key === key);
    if (slot?.file) URL.revokeObjectURL(slot.previewUrl);
    onChange(photos.filter((p) => p.key !== key));
  }

  function makeCover(key: string) {
    const slot = photos.find((p) => p.key === key);
    if (!slot) return;
    onChange([slot, ...photos.filter((p) => p.key !== key)]);
  }

  const actionClass =
    "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1.5 text-[10px] sm:text-[11px] font-semibold text-foreground/80 transition-colors hover:bg-primary-soft hover:text-primary disabled:pointer-events-none disabled:opacity-50";

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {photos.map((p, i) => (
          <div key={p.key} className="flex flex-col overflow-hidden rounded-2xl border bg-card">
            <div className="relative bg-muted">
              <button
                type="button"
                onClick={() => setViewer(i)}
                className="block w-full cursor-zoom-in"
                aria-label={`Ver foto ${i + 1} en grande`}
              >
                <img src={p.previewUrl} alt={`Foto ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
                <span className="absolute bottom-2 right-2 grid size-7 place-items-center rounded-full bg-card/90 text-foreground backdrop-blur">
                  <Maximize2 className="size-3.5" />
                </span>
              </button>
              {i === 0 ? (
                <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-card/90 px-2 py-0.5 text-[11px] font-semibold text-foreground backdrop-blur">
                  <Star className="size-3" /> Portada
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => makeCover(p.key)}
                  disabled={locked}
                  className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-card/90 px-2 py-0.5 text-[11px] font-semibold text-foreground backdrop-blur hover:bg-card disabled:opacity-50"
                >
                  <Star className="size-3" /> Usar de portada
                </button>
              )}
              {p.file && (
                <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-card/90 px-2 py-0.5 text-[11px] font-medium text-muted-foreground backdrop-blur">
                  {Math.max(1, Math.round(p.file.size / 1024))} KB
                </span>
              )}
              {workingKey === p.key && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-primary-soft/90 text-primary">
                  <Loader2 className="size-6 animate-spin" />
                  <span className="text-xs font-semibold">Optimizando imagen...</span>
                </div>
              )}
            </div>
            <div className="flex gap-1 border-t p-1">
              <label
                className={cn(actionClass, "cursor-pointer", locked && "pointer-events-none opacity-50")}
                aria-label={`Cambiar foto ${i + 1}`}
              >
                <Replace className="size-4" />
                Cambiar
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => replace(p.key, e)}
                  disabled={locked}
                />
              </label>
              <button
                type="button"
                className={actionClass}
                onClick={() => setCropKey(p.key)}
                disabled={locked}
                aria-label={`Recortar foto ${i + 1}`}
              >
                <Crop className="size-4" />
                Recortar
              </button>
              <button
                type="button"
                className={actionClass}
                onClick={() => rotate(p.key)}
                disabled={locked}
                aria-label={`Girar foto ${i + 1}`}
              >
                <RotateCw className="size-4" />
                Girar
              </button>
              <button
                type="button"
                className={cn(actionClass, "hover:bg-destructive/10 hover:text-destructive")}
                onClick={() => remove(p.key)}
                disabled={locked}
                aria-label={`Quitar foto ${i + 1}`}
              >
                <Trash2 className="size-4" />
                Quitar
              </button>
            </div>
          </div>
        ))}

        {optimizing > 0 && (
          <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary-soft text-primary">
            <Loader2 className="size-6 animate-spin" />
            <span className="text-xs font-semibold">Optimizando imagen...</span>
          </div>
        )}

        {optimizing === 0 && remaining > 0 && (
          <label
            className={cn(
              "flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed bg-muted/50 px-2 text-center text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary-soft",
              locked && "pointer-events-none opacity-60",
            )}
          >
            <ImagePlus className="size-7" />
            <span className="text-xs font-medium">
              {photos.length === 0 ? "Agregar fotos" : "Agregar otra foto"}
            </span>
            <input
              type="file"
              accept="image/*"
              multiple={remaining > 1}
              className="sr-only"
              onChange={onFiles}
              disabled={locked}
            />
          </label>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Hasta {MAX_LISTING_PHOTOS} fotos. Tocá una foto para verla en grande. Las achicamos automáticamente para que carguen rápido.
      </p>

      <PhotoLightbox
        urls={photos.map((p) => p.previewUrl)}
        startIndex={viewer ?? 0}
        open={viewer !== null}
        onOpenChange={(o) => !o && setViewer(null)}
        title="Vista previa"
      />
      <PhotoCropDialog
        imageUrl={cropSlot?.previewUrl ?? null}
        open={cropSlot !== null}
        onOpenChange={(o) => !o && setCropKey(null)}
        onConfirm={applyCrop}
      />
    </div>
  );
}
