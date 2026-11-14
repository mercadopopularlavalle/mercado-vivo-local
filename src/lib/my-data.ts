import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveImageUrls } from "./listing-images";

export type MyProfile = {
  display_name: string;
  store_name: string | null;
  whatsapp: string | null;
  city: string | null;
  is_active: boolean;
};

/** Fields a seller may edit on their own profile (activation is admin-only). */
export type EditableProfile = Pick<MyProfile, "display_name" | "store_name" | "whatsapp" | "city">;

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
      return data;
    },
  });

export type MyListing = {
  id: string;
  title: string;
  price: number;
  category: string;
  location: string;
  status: "active" | "paused";
  imagePath: string | null;
  imageUrl: string | null;
  createdAt: string;
};

export const myListingsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["my-listings", userId],
    queryFn: async (): Promise<MyListing[]> => {
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, price, category, location, status, image_url, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const urls = await resolveImageUrls(supabase, data.map((r) => r.image_url));
      return data.map((r, i) => ({
        id: r.id,
        title: r.title,
        price: Number(r.price),
        category: r.category,
        location: r.location,
        status: r.status === "paused" ? "paused" : "active",
        imagePath: r.image_url,
        imageUrl: urls[i] ?? null,
        createdAt: r.created_at,
      }));
    },
  });

/** Saves the seller profile, creating it if the signup trigger has not. */
export async function saveMyProfile(userId: string, values: Partial<EditableProfile>) {
  const { data: existing } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("profiles").update(values).eq("id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("profiles")
      .insert({ id: userId, display_name: values.display_name || "Vendedor", ...values });
    if (error) throw error;
  }
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
