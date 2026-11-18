import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "./chunk-reload";

describe("isChunkLoadError", () => {
  it("detects a failed dynamic import of an old asset", () => {
    expect(
      isChunkLoadError(
        new TypeError("Failed to fetch dynamically imported module: https://x.lovable.app/assets/auth-wTnAyDTm.js"),
      ),
    ).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isChunkLoadError(new Error("Email o contraseña incorrectos"))).toBe(false);
  });
});
