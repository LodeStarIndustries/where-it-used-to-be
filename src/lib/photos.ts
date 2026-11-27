import "server-only";
// Photos for places and submissions. Every upload is re-encoded with sharp,
// which drops all metadata (GPS location, camera, date) before it's stored.
// The bucket is private; admins see photos through short-lived signed URLs.
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "photos";
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_SIDE = 2048;

function storage() {
  const db = createAdminClient();
  if (!db) throw new Error("Supabase is not configured");
  return db.storage.from(BUCKET);
}

export class BadPhotoError extends Error {}

/** Checks the file really is a JPEG or PNG, then re-encodes it as a metadata-free JPEG. */
export async function cleanPhoto(input: Buffer): Promise<Buffer> {
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new BadPhotoError("Photos can be up to 5 MB.");
  let format: string | undefined;
  try {
    format = (await sharp(input).metadata()).format;
  } catch {
    throw new BadPhotoError("That file isn't a photo we can read. Use a JPG or PNG.");
  }
  if (format !== "jpeg" && format !== "png") throw new BadPhotoError("Use a JPG or PNG photo.");
  // rotate() applies the camera's orientation first, so dropping metadata doesn't turn photos sideways.
  return sharp(input)
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

/** Stores a cleaned photo under folder/ and returns its path in the bucket. */
export async function storePhoto(folder: "submissions" | "places", jpeg: Buffer): Promise<string> {
  const path = `${folder}/${crypto.randomUUID()}.jpg`;
  const { error } = await storage().upload(path, jpeg, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(`Saving the photo: ${error.message}`);
  return path;
}

export async function copyPhoto(from: string, folder: "places"): Promise<string> {
  const to = `${folder}/${crypto.randomUUID()}.jpg`;
  const { error } = await storage().copy(from, to);
  if (error) throw new Error(`Copying the photo: ${error.message}`);
  return to;
}

export async function deletePhoto(path: string) {
  await storage().remove([path]);
}

/** A link that works for 30 minutes, for showing a private photo to an admin. */
export async function signedPhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await storage().createSignedUrl(path, 1800);
  return data?.signedUrl ?? null;
}
