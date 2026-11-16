import { supabase } from "@/integrations/supabase/client";
import { extensionFor, MAX_LISTING_PHOTOS } from "./image-optimize";
import { isStoragePath, LISTING_BUCKET } from "./listing-images";

/** One photo slot in a listing form: either an already-stored path or a new optimized file. */
export type PhotoSlot = { key: string; previewUrl: string; file?: File; path?: string | null };

export function slotsFromListing(paths: Array<string | null>, urls: Array<string | null>): PhotoSlot[] {
  const slots: PhotoSlot[] = [];
  paths.forEach((path, i) => {
    const url = urls[i];
    if (path && url) slots.push({ key: `existing-${i}-${path}`, previewUrl: url, path });
  });
  return slots;
}

/** Uploads new files and returns the two listing columns (first photo is the cover). */
export async function uploadListingPhotos(userId: string, slots: PhotoSlot[]) {
  const kept = slots.slice(0, MAX_LISTING_PHOTOS);
  const uploaded: string[] = [];
  const paths: Array<string | null> = [];
  try {
    for (const slot of kept) {
      if (slot.file) {
        const path = `${userId}/${crypto.randomUUID()}.${extensionFor(slot.file)}`;
        const { error } = await supabase.storage
          .from(LISTING_BUCKET)
          .upload(path, slot.file, { contentType: slot.file.type, upsert: false });
        if (error) throw error;
        uploaded.push(path);
        paths.push(path);
      } else {
        paths.push(slot.path ?? null);
      }
    }
  } catch (err) {
    if (uploaded.length) await supabase.storage.from(LISTING_BUCKET).remove(uploaded);
    throw err;
  }
  return { image_url: paths[0] ?? null, image_url_2: paths[1] ?? null, uploaded };
}

/** Deletes stored photos that are no longer referenced (seed photos in /public are ignored). */
export async function removeStoredPhotos(paths: Array<string | null | undefined>) {
  const toRemove = paths.filter(isStoragePath);
  if (toRemove.length) await supabase.storage.from(LISTING_BUCKET).remove(toRemove);
}
