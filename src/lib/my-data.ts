import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveImageUrls } from "./listing-images";

export type MyProfile = { display_name: string; whatsapp: string | null; city: string | null };

export const myProfileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["my-profile", userId],
    queryFn: async (): Promise<MyProfile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, whatsapp, city")
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
export async function saveMyProfile(userId: string, values: Partial<MyProfile>) {
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
