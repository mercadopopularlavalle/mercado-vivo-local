import { useState, type ChangeEvent } from "react";
import { ImagePlus, Loader2, Star, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImageOptimizeError, MAX_LISTING_PHOTOS, optimizeImage } from "@/lib/image-optimize";
import type { PhotoSlot } from "@/lib/listing-photos";
import { cn } from "@/lib/utils";

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
  const remaining = MAX_LISTING_PHOTOS - photos.length;

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
        toast.error(err instanceof ImageOptimizeError ? err.message : "No pudimos optimizar la foto");
      }
    }
    setOptimizing(0);
    onBusyChange?.(false);
    if (added.length) onChange([...photos, ...added].slice(0, MAX_LISTING_PHOTOS));
  }

  function remove(key: string) {
    const slot = photos.find((p) => p.key === key);
    if (slot?.file) URL.revokeObjectURL(slot.previewUrl);
    onChange(photos.filter((p) => p.key !== key));
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {photos.map((p, i) => (
          <div key={p.key} className="relative overflow-hidden rounded-2xl border bg-muted">
            <img src={p.previewUrl} alt={`Foto ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
            {i === 0 && (
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-card/90 px-2 py-0.5 text-[11px] font-semibold text-foreground backdrop-blur">
                <Star className="size-3" /> Portada
              </span>
            )}
            {p.file && (
              <span className="absolute bottom-2 left-2 rounded-full bg-card/90 px-2 py-0.5 text-[11px] font-medium text-muted-foreground backdrop-blur">
                Optimizada · {Math.max(1, Math.round(p.file.size / 1024))} KB
              </span>
            )}
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute right-2 top-2 size-8 rounded-full"
              onClick={() => remove(p.key)}
              disabled={disabled || optimizing > 0}
              aria-label={`Quitar foto ${i + 1}`}
            >
              <X className="size-4" />
            </Button>
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
              disabled && "pointer-events-none opacity-60",
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
              disabled={disabled}
            />
          </label>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Hasta {MAX_LISTING_PHOTOS} fotos. Las achicamos automáticamente para que carguen rápido.
      </p>
    </div>
  );
}
