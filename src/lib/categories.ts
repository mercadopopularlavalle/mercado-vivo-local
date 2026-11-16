import {
  Car,
  Fish,
  Gift,
  Shirt,
  Smartphone,
  Sofa,
  Sparkles,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export const CATEGORIES = [
  { slug: "hogar", label: "Hogar", icon: Sofa },
  { slug: "indumentaria", label: "Indumentaria", icon: Shirt },
  { slug: "comidas-bebidas", label: "Comidas y Bebidas", icon: UtensilsCrossed },
  { slug: "servicios", label: "Servicios", icon: Wrench },
  { slug: "electronica", label: "Electrónica", icon: Smartphone },
  { slug: "vehiculos", label: "Vehículos", icon: Car },
  { slug: "art-pesca", label: "Art. de pesca", icon: Fish },
  { slug: "art-limpieza", label: "Art. de limpieza", icon: Sparkles },
  { slug: "art-navidad", label: "Art. de Navidad", icon: Gift },
] as const satisfies ReadonlyArray<{ slug: string; label: string; icon: LucideIcon }>;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as [CategorySlug, ...CategorySlug[]];

export function isCategorySlug(value: unknown): value is CategorySlug {
  return typeof value === "string" && (CATEGORY_SLUGS as readonly string[]).includes(value);
}

export function categoryLabel(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}
