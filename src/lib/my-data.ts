import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveImageUrls } from "./listing-images";

export type MyProfile = {
  display_name: string;
  store_name: string | null;
  whatsapp: string | null;
  city: string | null;
  logo_url?: string | null;
  is_active: boolean;
};

/** Fields a seller may edit on their own profile (activation is admin-only). */
export type EditableProfile = Pick<MyProfile, "display_name" | "store_name" | "whatsapp" | "city"> & {
  logo_url?: string | null;
};

export function parseStockFromDescription(description: string | null | undefined): number {
  if (!description) return 1;
  const match = description.match(/\[STOCK:(\d+)\]/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return 1;
}

export function updateDescriptionWithStock(description: string | null | undefined, stock: number): string {
  const baseDesc = (description ?? "").replace(/\[STOCK:\d+\]/gi, "").trim();
  return `${baseDesc} [STOCK:${stock}]`.trim();
}

export const myProfileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["my-profile", userId],
    queryFn: async (): Promise<MyProfile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, store_name, whatsapp, city, is_active")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      // Recuperar logo_url desde user_metadata o cache local
      let logo_url: string | null = null;
      try {
        const { data: authData } = await supabase.auth.getUser();
        logo_url = (authData.user?.user_metadata?.["store_logo"] as string) || null;
      } catch {
        // fallback
      }
      if (!logo_url && typeof window !== "undefined") {
        logo_url = localStorage.getItem(`mp_store_logo_${userId}`);
      }

      return {
        ...data,
        logo_url,
      };
    },
  });

export type MyListing = {
  id: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  location: string;
  status: "active" | "paused";
  imagePath: string | null;
  imageUrl: string | null;
  /** Both photo slots (cover first); entries may be null. */
  imagePaths: Array<string | null>;
  imageUrls: Array<string | null>;
  createdAt: string;
};

export const myListingsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["my-listings", userId],
    queryFn: async (): Promise<MyListing[]> => {
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, description, price, category, location, status, image_url, image_url_2, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const urls = await resolveImageUrls(
        supabase,
        data.flatMap((r) => [r.image_url, r.image_url_2]),
      );
      return data.map((r, i) => {
        const stock = parseStockFromDescription(r.description);
        return {
          id: r.id,
          title: r.title,
          description: r.description ?? "",
          price: Number(r.price),
          stock,
          category: r.category,
          location: r.location,
          status: r.status === "paused" ? "paused" : "active",
          imagePath: r.image_url,
          imageUrl: urls[i * 2] ?? null,
          imagePaths: [r.image_url, r.image_url_2],
          imageUrls: [urls[i * 2] ?? null, urls[i * 2 + 1] ?? null],
          createdAt: r.created_at,
        };
      });
    },
  });

/** Saves the seller profile, creating it if the signup trigger has not. */
export async function saveMyProfile(userId: string, values: Partial<EditableProfile>) {
  const { logo_url, ...dbValues } = values;

  const { data: existing } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("profiles").update(dbValues).eq("id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("profiles")
      .insert({ id: userId, display_name: dbValues.display_name || "Vendedor", ...dbValues });
    if (error) throw error;
  }

  if (logo_url !== undefined) {
    if (typeof window !== "undefined") {
      if (logo_url) {
        localStorage.setItem(`mp_store_logo_${userId}`, logo_url);
      } else {
        localStorage.removeItem(`mp_store_logo_${userId}`);
      }
    }
    try {
      await supabase.auth.updateUser({
        data: {
          store_logo: logo_url,
          store_name: values.store_name,
        },
      });
    } catch {
      // Ignore if offline
    }
  }
}

export async function updateListingPriceAndStock(
  listingId: string,
  currentDescription: string,
  price: number,
  stock: number,
) {
  const newDescription = updateDescriptionWithStock(currentDescription, stock);
  const newStatus = stock === 0 ? "paused" : "active";
  const { error } = await supabase
    .from("listings")
    .update({
      price: Math.max(0, Math.round(price)),
      description: newDescription,
      status: newStatus,
    })
    .eq("id", listingId);
  if (error) throw error;
}

export const isAdminQuery = (userId: string) =>
  queryOptions({
    queryKey: ["is-admin", userId],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    staleTime: 60_000,
  });

export type AppSettings = { mercadopago_url: string | null; admin_whatsapp: string | null };

export const appSettingsQuery = () =>
  queryOptions({
    queryKey: ["app-settings"],
    queryFn: async (): Promise<AppSettings> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("mercadopago_url, admin_whatsapp")
        .maybeSingle();
      if (error) throw error;
      return data ?? { mercadopago_url: null, admin_whatsapp: null };
    },
    staleTime: 60_000,
  });
