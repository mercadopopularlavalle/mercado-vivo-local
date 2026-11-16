import { describe, expect, it } from "vitest";
import { encodeUnderLimit, fitWithin, MAX_IMAGE_BYTES, MAX_IMAGE_SIDE } from "./image-optimize";

describe("photo resizing", () => {
  it("limits a landscape photo's longest side to 1080px keeping proportions", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1080, height: 810 });
  });

  it("limits a portrait phone photo's longest side to 1080px", () => {
    expect(fitWithin(3024, 4032)).toEqual({ width: 810, height: 1080 });
  });

  it("does not enlarge small photos", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("photo compression", () => {
  // Fake encoder: size grows with pixels and quality, like a real codec.
  const fakeEncoder = (bytesPerPixelAtFullQuality: number) => async (w: number, h: number, q: number) =>
    new Blob([new Uint8Array(Math.round(w * h * bytesPerPixelAtFullQuality * q))]);

  it("ends under 350 KB even for a heavy 10 MB-class photo", async () => {
    const { blob, width, height } = await encodeUnderLimit(fakeEncoder(3), 6000, 4000);
    expect(blob.size).toBeLessThanOrEqual(350 * 1024);
    expect(Math.max(width, height)).toBeLessThanOrEqual(MAX_IMAGE_SIDE);
  });

  it("keeps full 1080px size when lowering quality is enough", async () => {
    const { blob, width } = await encodeUnderLimit(fakeEncoder(0.5), 4000, 3000);
    expect(blob.size).toBeLessThanOrEqual(MAX_IMAGE_BYTES);
    expect(width).toBe(1080);
  });
});
