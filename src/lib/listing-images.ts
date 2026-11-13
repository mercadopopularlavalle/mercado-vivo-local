import type { SupabaseClient } from "@supabase/supabase-js";

export const LISTING_BUCKET = "listing-images";

/** Seed photos live in /public; uploaded photos are paths inside the private bucket. */
export function isStoragePath(value: string | null | undefined): value is string {
  return !!value && !value.startsWith("/") && !value.startsWith("http");
}

/**
 * Turns stored image references into displayable URLs.
 * `publicBase` swaps the server-side backend address for the browser-facing one.
 */
export async function resolveImageUrls(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any, any, any>,
  values: Array<string | null>,
  rewrite?: { from: string; to: string },
): Promise<Array<string | null>> {
  const paths = values.filter(isStoragePath);
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await client.storage.from(LISTING_BUCKET).createSignedUrls(paths, 60 * 60 * 6);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) {
        let url = item.signedUrl;
        if (rewrite && rewrite.from && url.startsWith(rewrite.from)) {
          url = rewrite.to + url.slice(rewrite.from.length);
        }
        signed.set(item.path, url);
      }
    }
  }
  return values.map((v) => (isStoragePath(v) ? (signed.get(v) ?? null) : v));
}
