import { describe, expect, it } from "vitest";
import { buildWhatsappLink, isValidWhatsapp, normalizeWhatsapp, sanitizeSearch } from "./format";

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
