import { describe, expect, it } from "vitest";
import { CLAIMS_EMAIL, telHref, USEFUL_PHONES } from "./contacts";

describe("teléfonos útiles de la columna lateral", () => {
  it("muestra los cuatro teléfonos del pueblo con su número exacto", () => {
    const byName = Object.fromEntries(USEFUL_PHONES.map((p) => [p.name, p.phone]));
    expect(byName).toEqual({
      "Hospital Sagrado Corazón de Jesús": "225249-1037",
      "Consultorios externos": "2257417936",
      "Bomberos Cuartel 233 Central": "2257582740",
      Policía: "2252491099",
    });
  });

  it("el enlace de llamada usa solo dígitos", () => {
    expect(telHref("225249-1037")).toBe("tel:2252491037");
  });
});

describe("contacto para reclamos", () => {
  it("apunta al correo del pueblo", () => {
    expect(CLAIMS_EMAIL).toBe("mercadopopularlavalle@gmail.com");
  });
});
