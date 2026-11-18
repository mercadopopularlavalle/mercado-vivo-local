import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CATEGORY_SLUGS } from "./categories";
import { sanitizeSearch } from "./format";
import { resolveImageUrls } from "./listing-images";
import { createPublicServerClient, storageRewrite } from "./supabase-public.server";

export type ListingSummary = {
  id: string;
  title: string;
  price: number;
  category: string;
  location: string;
  imageUrl: string | null;
  createdAt: string;
  /** "Solo por hoy" listing that disappears at the end of the day. */
  isFlashToday: boolean;
  expiresAt: string | null;
};

export type ListingDetail = ListingSummary & {
  description: string;
  /** Up to two photos; the first one is the cover. */
  imageUrls: string[];
  seller: { name: string; store: string | null; whatsapp: string | null; city: string | null };
};

export const listListings = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z
      .object({
        q: z.string().max(200).optional(),
        category: z.enum(CATEGORY_SLUGS).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<ListingSummary[]> => {
    const supabase = createPublicServerClient();
    let query = supabase
      .from("listings")
      .select("id, title, price, category, location, image_url, created_at, is_flash_today, expires_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(60);

    if (data.category) query = query.eq("category", data.category);
    const term = data.q ? sanitizeSearch(data.q) : "";
    if (term) {
      query = query.or(
        `title.ilike.%${term}%,description.ilike.%${term}%,location.ilike.%${term}%`,
      );
    }

    const { data: rows, error } = await query;
    if (error) throw new Error("No pudimos cargar los avisos");

    const urls = await resolveImageUrls(
      supabase,
      rows.map((r) => r.image_url),
      storageRewrite(),
    );
    return rows.map((r, i) => ({
      id: r.id,
      title: r.title,
      price: Number(r.price),
      category: r.category,
      location: r.location,
      imageUrl: urls[i] ?? null,
      createdAt: r.created_at,
      isFlashToday: r.is_flash_today,
      expiresAt: r.expires_at,
    }));
  });

export const getListing = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<ListingDetail | null> => {
    const supabase = createPublicServerClient();
    const { data: row, error } = await supabase
      .from("listings")
      .select(
        "id, title, description, price, category, location, image_url, image_url_2, created_at, is_flash_today, expires_at, profiles(display_name, store_name, whatsapp, city)",
      )
      .eq("id", data.id)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw new Error("No pudimos cargar el aviso");
    if (!row) return null;

    const resolved = await resolveImageUrls(supabase, [row.image_url, row.image_url_2], storageRewrite());
    const imageUrls = resolved.filter((u): u is string => !!u);
    const profile = row.profiles as {
      display_name: string;
      store_name: string | null;
      whatsapp: string | null;
      city: string | null;
    } | null;
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      price: Number(row.price),
      category: row.category,
      location: row.location,
      imageUrl: imageUrls[0] ?? null,
      imageUrls,
      createdAt: row.created_at,
      isFlashToday: row.is_flash_today,
      expiresAt: row.expires_at,
      seller: {
        name: profile?.display_name ?? "Vendedor",
        store: profile?.store_name ?? null,
        whatsapp: profile?.whatsapp ?? null,
        city: profile?.city ?? null,
      },
    };
  });
