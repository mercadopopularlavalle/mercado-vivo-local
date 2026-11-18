import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/** Full-screen viewer that shows a photo complete (not cropped), with arrows when there are several. */
export function PhotoLightbox({
  urls,
  startIndex,
  open,
  onOpenChange,
  title,
}: {
  urls: string[];
  startIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
}) {
  const [index, setIndex] = useState(startIndex);
  useEffect(() => {
    if (open) setIndex(startIndex);
  }, [open, startIndex]);

  const count = urls.length;
  const current = urls[Math.min(index, count - 1)];
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-foreground/95 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 outline-none sm:p-8"
          onKeyDown={(e) => {
            if (count < 2) return;
            if (e.key === "ArrowRight") go(1);
            if (e.key === "ArrowLeft") go(-1);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onOpenChange(false);
          }}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Foto en tamaño completo</DialogPrimitive.Description>
          {current && (
            <img
              src={current}
              alt={count > 1 ? `${title} — foto ${index + 1}` : title}
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            />
          )}

          <DialogPrimitive.Close
            className="absolute right-3 top-3 grid size-11 place-items-center rounded-full bg-background/90 text-foreground shadow-md transition-colors hover:bg-background"
            aria-label="Cerrar foto"
          >
            <X className="size-5" />
          </DialogPrimitive.Close>

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Foto anterior"
                className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-background/90 text-foreground shadow-md transition-colors hover:bg-background"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Foto siguiente"
                className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-background/90 text-foreground shadow-md transition-colors hover:bg-background"
              >
                <ChevronRight className="size-6" />
              </button>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-background/90 px-3 py-1 text-sm font-semibold text-foreground">
                {index + 1} / {count}
              </span>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
