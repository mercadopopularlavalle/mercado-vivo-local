import { describe, expect, it } from "vitest";
import {
  buildPaymentNoticeLink,
  buildWhatsappLink,
  isHttpsUrl,
  isValidWhatsapp,
  normalizeWhatsapp,
  sanitizeSearch,
} from "./format";

describe("WhatsApp contact", () => {
  it("links to wa.me with the seller phone digits only", () => {
    const link = buildWhatsappLink("+54 9 11 5555-0101", "Sillón");
    expect(link.startsWith("https://wa.me/5491155550101?text=")).toBe(true);
  });

  it("normalizes formatted numbers", () => {
    expect(normalizeWhatsapp("+54 (351) 555-0103")).toBe("543515550103");
  });

  it("rejects numbers that are too short", () => {
    expect(isValidWhatsapp("1234")).toBe(false);
    expect(isValidWhatsapp("5491155550101")).toBe(true);
  });
});

describe("search", () => {
  it("removes filter-breaking characters", () => {
    expect(sanitizeSearch("silla,(roja)%")).toBe("silla roja");
  });
});

describe("subscription payment", () => {
  it("'Ya pagué' notifies the admin WhatsApp with the store and account", () => {
    const link = buildPaymentNoticeLink("+54 9 351 555-0000", "Tienda Gachy", "a@b.com");
    expect(link.startsWith("https://wa.me/5493515550000?text=")).toBe(true);
    const text = decodeURIComponent(link.split("text=")[1] ?? "");
    expect(text).toContain("Tienda Gachy");
    expect(text).toContain("a@b.com");
  });

  it("only accepts https links for the Mercado Pago button", () => {
    expect(isHttpsUrl("https://www.mercadopago.com.ar/subscriptions/checkout?x=1")).toBe(true);
    expect(isHttpsUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpsUrl("http://mpago.la/abc")).toBe(false);
  });
});
