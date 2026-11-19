import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import type { CropArea } from "@/lib/image-optimize";
import { cn } from "@/lib/utils";

const SHAPES = [
  { label: "Horizontal", aspect: 4 / 3 },
  { label: "Cuadrada", aspect: 1 },
  { label: "Vertical", aspect: 3 / 4 },
];
const DEFAULT_ASPECT = 4 / 3;

export function PhotoCropDialog({
  imageUrl,
  open,
  onOpenChange,
  onConfirm,
}: {
  imageUrl: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (area: CropArea) => Promise<void>;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  function reset(o: boolean) {
    if (!o) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setAspect(DEFAULT_ASPECT);
      setArea(null);
    }
    onOpenChange(o);
  }

  async function confirm() {
    if (!area) return;
    setSaving(true);
    try {
      await onConfirm(area);
      reset(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && reset(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Recortar foto</DialogTitle>
          <DialogDescription>Mové la foto y usá el zoom para elegir qué parte se ve.</DialogDescription>
        </DialogHeader>

        <div className="relative h-72 overflow-hidden rounded-xl bg-foreground sm:h-80">
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
              restrictPosition
            />
          )}
        </div>

        <div className="flex gap-2" role="group" aria-label="Forma del recorte">
          {SHAPES.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setAspect(s.aspect)}
              aria-pressed={aspect === s.aspect}
              className={cn(
                "flex-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                aspect === s.aspect ? "border-primary bg-primary text-primary-foreground" : "hover:bg-primary-soft",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
          Zoom
          <Slider value={[zoom]} min={1} max={4} step={0.05} onValueChange={([z]) => setZoom(z ?? 1)} aria-label="Zoom" />
        </label>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => reset(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirm} disabled={!area || saving}>
            {saving ? (
              <>
                <Loader2 className="animate-spin" /> Optimizando imagen...
              </>
            ) : (
              "Aplicar recorte"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
