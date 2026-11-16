/** Browser-side photo optimization applied before any upload to storage. */

export const MAX_IMAGE_SIDE = 1080;
export const MAX_IMAGE_BYTES = 350 * 1024;
/** A listing can have at most this many photos. */
export const MAX_LISTING_PHOTOS = 2;

const START_QUALITY = 0.85;
const MIN_QUALITY = 0.55;
const MAX_ATTEMPTS = 12;

/** Scales width/height so the longest side is at most `maxSide`, keeping proportions (never upscales). */
export function fitWithin(width: number, height: number, maxSide = MAX_IMAGE_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export type Encoder = (width: number, height: number, quality: number) => Promise<Blob>;

/**
 * Encodes repeatedly, lowering quality first and then dimensions, until the result fits under `maxBytes`.
 */
export async function encodeUnderLimit(
  encode: Encoder,
  sourceWidth: number,
  sourceHeight: number,
  maxBytes = MAX_IMAGE_BYTES,
): Promise<{ blob: Blob; width: number; height: number }> {
  let { width, height } = fitWithin(sourceWidth, sourceHeight);
  let quality = START_QUALITY;
  let blob = await encode(width, height, quality);
  for (let i = 1; i < MAX_ATTEMPTS && blob.size > maxBytes; i++) {
    if (quality - 0.1 >= MIN_QUALITY - 1e-9) {
      quality = Math.round((quality - 0.1) * 100) / 100;
    } else {
      width = Math.max(1, Math.round(width * 0.85));
      height = Math.max(1, Math.round(height * 0.85));
    }
    blob = await encode(width, height, quality);
  }
  return { blob, width, height };
}

let webpSupport: boolean | null = null;
function supportsWebp(): boolean {
  if (webpSupport === null) {
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      webpSupport = c.toDataURL("image/webp").startsWith("data:image/webp");
    } catch {
      webpSupport = false;
    }
  }
  return webpSupport;
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // fall back to <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

export class ImageOptimizeError extends Error {}

/** Resizes to 1080px max side, converts to WebP (JPEG fallback) and compresses under 350 KB. */
export async function optimizeImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new ImageOptimizeError("El archivo debe ser una imagen");
  let decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new ImageOptimizeError("No pudimos leer esta foto. Probá con otra en JPG, PNG o WebP.");
  }
  const type = supportsWebp() ? "image/webp" : "image/jpeg";
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageOptimizeError("Tu navegador no pudo procesar la foto");

  const encode: Encoder = (w, h, q) => {
    canvas.width = w;
    canvas.height = h;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (type === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }
    ctx.drawImage(decoded.source, 0, 0, w, h);
    return new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new ImageOptimizeError("No pudimos comprimir la foto"))), type, q),
    );
  };

  try {
    const { blob } = await encodeUnderLimit(encode, decoded.width, decoded.height);
    const ext = type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `foto.${ext}`, { type });
  } finally {
    decoded.close();
  }
}

export function extensionFor(file: File): string {
  return file.type === "image/webp" ? "webp" : "jpg";
}
