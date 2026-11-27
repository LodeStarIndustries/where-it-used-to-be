"use server";
// Suggest a place (signed-in players). Checked on the server: session, display
// name, 5 a day, every field, offensive words, and the photo itself.
import { redirect } from "next/navigation";
import { z } from "zod";
import { categories, eras, game, type Category, type Era } from "@config/game";
import { getProfile, rateLimit } from "@/lib/account/data";
import { isOffensive } from "@/lib/account/profanity";
import { currentUserId } from "@/lib/auth/session";
import { BadPhotoError, MAX_UPLOAD_BYTES, cleanPhoto, deletePhoto, storePhoto } from "@/lib/photos";
import { createSubmission } from "./data";

export type SuggestState = { status: "idle" } | { status: "error"; errors: string[] };

const optional = (max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null),
    z.string().max(max, `${label}: use ${max} characters or fewer.`).nullable(),
  );

const [[west, south], [east, north]] = game.map.bounds;
const suggestionSchema = z.object({
  businessName: z.string().trim().min(1, "Enter the business name.").max(120, "Business name: 120 characters or fewer."),
  category: z.enum(categories as [Category, ...Category[]], { error: "Pick a category." }),
  lat: z.coerce.number({ error: "Drop a pin on the map." }).min(south, "Drop the pin inside Saint John.").max(north, "Drop the pin inside Saint John."),
  lng: z.coerce.number({ error: "Drop a pin on the map." }).min(west, "Drop the pin inside Saint John.").max(east, "Drop the pin inside Saint John."),
  addressText: optional(200, "Address"),
  currentUse: optional(120, "What's there now"),
  yearsText: optional(60, "When it was open"),
  era: z.preprocess((v) => (v === "" ? null : v), z.enum(eras as [Era, ...Era[]]).nullable()),
  memory: optional(500, "Memory"),
  notResidence: z.literal("on", { error: "Confirm it was a business or public place, not someone's home." }),
});

export async function submitSuggestionAction(_prev: SuggestState, formData: FormData): Promise<SuggestState> {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in?next=/suggest");
  const profile = await getProfile(userId);
  if (!profile?.displayName) redirect("/welcome?next=/suggest");

  const parsed = suggestionSchema.safeParse({
    businessName: formData.get("businessName"),
    category: formData.get("category"),
    lat: formData.get("lat") || undefined,
    lng: formData.get("lng") || undefined,
    addressText: formData.get("addressText"),
    currentUse: formData.get("currentUse"),
    yearsText: formData.get("yearsText"),
    era: formData.get("era") ?? "",
    memory: formData.get("memory"),
    notResidence: formData.get("notResidence") ?? undefined,
  });
  const photo = formData.get("photo");
  const hasPhoto = photo instanceof Blob && photo.size > 0;
  const errors = parsed.success ? [] : [...new Set(parsed.error.issues.map((i) => i.message))];
  if (hasPhoto && formData.get("photoRights") !== "on") {
    errors.push("Confirm you took the photo or have permission to share it, or remove the photo.");
  }
  if (hasPhoto && photo.size > MAX_UPLOAD_BYTES) errors.push("Photos can be up to 5 MB.");
  if (parsed.success) {
    const d = parsed.data;
    if ([d.businessName, d.addressText, d.currentUse, d.yearsText, d.memory].some((t) => t && isOffensive(t))) {
      errors.push("Please keep it clean: something in the suggestion isn't allowed.");
    }
  }
  if (errors.length || !parsed.success) return { status: "error", errors };

  if (!(await rateLimit(`suggest:${userId}`, 86400, game.rateLimits.submissionsPerDayPerPlayer))) {
    return {
      status: "error",
      errors: [`You can suggest up to ${game.rateLimits.submissionsPerDayPerPlayer} places a day. Thanks for all of them! Try again tomorrow.`],
    };
  }

  let photoPath: string | null = null;
  try {
    if (hasPhoto) photoPath = await storePhoto("submissions", await cleanPhoto(Buffer.from(await photo.arrayBuffer())));
    const { notResidence: _, ...fields } = parsed.data;
    void _;
    await createSubmission(userId, { ...fields, photoPath });
  } catch (err) {
    if (photoPath) await deletePhoto(photoPath).catch(() => {});
    if (err instanceof BadPhotoError) return { status: "error", errors: [err.message] };
    console.error(err);
    return { status: "error", errors: ["Couldn't send your suggestion. Try again in a moment."] };
  }
  redirect("/suggest/thanks");
}
