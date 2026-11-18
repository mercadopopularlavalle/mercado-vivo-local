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

/** Output size after turning a photo 90° clockwise `quarterTurns` times. */
export function rotatedSize(width: number, height: number, quarterTurns: number) {
  return quarterTurns % 2 === 0 ? { width, height } : { width: height, height: width };
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
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
  return processImage(file, {});
}

/** Turns a photo 90° clockwise and re-optimizes it with the same size/weight limits. */
export async function rotateImage(file: Blob): Promise<File> {
  return processImage(file, { quarterTurns: 1 });
}

/** A rectangle in the photo's own pixels. */
export type CropArea = { x: number; y: number; width: number; height: number };

/** Keeps a crop rectangle inside the photo and at least 1px in size. */
export function clampCrop(area: CropArea, width: number, height: number): CropArea {
  const x = Math.min(Math.max(0, Math.round(area.x)), width - 1);
  const y = Math.min(Math.max(0, Math.round(area.y)), height - 1);
  return {
    x,
    y,
    width: Math.max(1, Math.min(Math.round(area.width), width - x)),
    height: Math.max(1, Math.min(Math.round(area.height), height - y)),
  };
}

/** Keeps only `area` of the photo and re-optimizes it with the same size/weight limits. */
export async function cropImage(file: Blob, area: CropArea): Promise<File> {
  return processImage(file, { crop: area });
}

async function processImage(
  file: Blob,
  { quarterTurns = 0, crop }: { quarterTurns?: number; crop?: CropArea },
): Promise<File> {
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
  const turns = ((quarterTurns % 4) + 4) % 4;
  const src = crop
    ? clampCrop(crop, decoded.width, decoded.height)
    : { x: 0, y: 0, width: decoded.width, height: decoded.height };

  const encode: Encoder = (w, h, q) => {
    canvas.width = w;
    canvas.height = h;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (type === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }
    // Draw size is the un-rotated size of the source at this output scale.
    const draw = rotatedSize(w, h, turns);
    ctx.translate(w / 2, h / 2);
    ctx.rotate((turns * Math.PI) / 2);
    ctx.drawImage(
      decoded.source,
      src.x,
      src.y,
      src.width,
      src.height,
      -draw.width / 2,
      -draw.height / 2,
      draw.width,
      draw.height,
    );
    return new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new ImageOptimizeError("No pudimos comprimir la foto"))), type, q),
    );
  };

  try {
    const out = rotatedSize(src.width, src.height, turns);
    const { blob } = await encodeUnderLimit(encode, out.width, out.height);
    const ext = type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `foto.${ext}`, { type });
  } finally {
    decoded.close();
  }
}

export function extensionFor(file: File): string {
  return file.type === "image/webp" ? "webp" : "jpg";
}
