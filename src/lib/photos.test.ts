import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => null }));
const { BadPhotoError, cleanPhoto } = await import("./photos");

/** A small JPEG carrying GPS coordinates and a camera make in its EXIF. */
async function photoWithLocation(width = 400, height = 300) {
  return sharp({ create: { width, height, channels: 3, background: "#c0392b" } })
    .jpeg()
    .withExif({
      IFD0: { Make: "TEST camera", Orientation: "1" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "45/1 16/1 15/1", GPSLongitudeRef: "W", GPSLongitude: "66/1 3/1 43/1" },
    })
    .toBuffer();
}

describe("photo cleaning", () => {
  it("removes location and camera details", async () => {
    const original = await photoWithLocation();
    expect((await sharp(original).metadata()).exif).toBeDefined();
    const cleaned = await cleanPhoto(original);
    const meta = await sharp(cleaned).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.exif).toBeUndefined();
    expect(cleaned.includes(Buffer.from("TEST camera"))).toBe(false);
  });

  it("shrinks big photos to 2048 px on the long side", async () => {
    const big = await photoWithLocation(3000, 1500);
    const meta = await sharp(await cleanPhoto(big)).metadata();
    expect([meta.width, meta.height]).toEqual([2048, 1024]);
  });

  it("refuses files that aren't JPEG or PNG photos", async () => {
    await expect(cleanPhoto(Buffer.from("not an image"))).rejects.toBeInstanceOf(BadPhotoError);
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#000" } }).gif().toBuffer();
    await expect(cleanPhoto(gif)).rejects.toThrow(/JPG or PNG/);
  });
});
