import { queryOptions } from "@tanstack/react-query";
import type { CategorySlug } from "./categories";
import { getListing, listListings } from "./listings.functions";

export const listingsQuery = (q?: string, category?: CategorySlug) =>
  queryOptions({
    queryKey: ["listings", { q: q ?? "", category: category ?? null }],
    queryFn: () => listListings({ data: { q, category } }),
    staleTime: 30_000,
  });

export const listingQuery = (id: string) =>
  queryOptions({
    queryKey: ["listing", id],
    queryFn: () => getListing({ data: { id } }),
    staleTime: 30_000,
  });
