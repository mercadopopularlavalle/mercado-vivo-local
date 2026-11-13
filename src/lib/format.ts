const priceFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function formatPrice(value: number): string {
  return priceFormatter.format(value);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

/** Keeps only digits: "+54 9 11 5555-0101" -> "5491155550101". */
export function normalizeWhatsapp(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** A WhatsApp number must include country code: 8 to 15 digits. */
export function isValidWhatsapp(raw: string): boolean {
  return /^[0-9]{8,15}$/.test(normalizeWhatsapp(raw));
}

export function buildWhatsappLink(phone: string, listingTitle: string): string {
  const text = `¡Hola! Vi tu aviso "${listingTitle}" en Mercado Popular. ¿Sigue disponible?`;
  return `https://wa.me/${normalizeWhatsapp(phone)}?text=${encodeURIComponent(text)}`;
}

/** Strips characters that would break a text search filter. */
export function sanitizeSearch(raw: string): string {
  return raw
    .replace(/[,()%*\\:."']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}
