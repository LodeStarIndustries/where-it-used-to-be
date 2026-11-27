"use server";
// Admin server actions. Every one starts with assertAdmin(), checked on the
// server against the database, so a forged request from a player is refused.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertAdmin } from "./guard";
import { game } from "@config/game";
import { NotEnoughPlacesError, generateDays, wrongAnswersFor, type GeneratedRound } from "@/lib/game/generator";
import { addDays, puzzleDateFor } from "@/lib/puzzle-date";
import { checkCsv } from "./csv";
import {
  draftFromSubmission,
  getSubmission,
  markApproved,
  markDuplicate,
  markRejected,
  photoForPlace,
} from "@/lib/submissions/data";
import { BadPhotoError, cleanPhoto, deletePhoto, storePhoto } from "@/lib/photos";
import {
  insertPuzzle,
  livePool,
  puzzlesBetween,
  refreshLastUsed,
  updatePuzzle,
  allowsTestNames,
  existingNames,
  importPlaces,
  createPlace,
  deleteDraft,
  getPlace,
  moveToSite,
  resolveEvent,
  savePlace,
  setStatus,
  setVerified,
  sitesNear,
  setPlacePhoto,
} from "./data";
import { checkPlace, liveBlockers } from "./place-schema";
import type { NearbySite } from "./data";

export async function resolveEventAction(formData: FormData) {
  await assertAdmin();
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  await resolveEvent(id);
  revalidatePath("/admin");
}

// ---------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------

export type ActionResult = { ok: true; message?: string } | { ok: false; errors: string[] };

const uuid = z.uuid();

/** Turns a database error (often a rule in a trigger) into a message for the admin. */
function failure(err: unknown): ActionResult {
  const message = err instanceof Error ? err.message.replace(/^[^:]+: /, "") : "Something went wrong.";
  console.error(err);
  return { ok: false, errors: [message] };
}

/** Saves the editor. New places are created as drafts, on attachSiteId if given. */
export async function savePlaceAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const userId = await assertAdmin();
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { ok: false, errors: ["The form didn't send properly. Reload and try again."] };
  }
  const parsed = checkPlace(payload);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const id = formData.get("id") ? uuid.parse(formData.get("id")) : null;
  const siteId = formData.get("siteId") ? uuid.parse(formData.get("siteId")) : null;
  const attach = formData.get("attachSiteId") ? uuid.parse(formData.get("attachSiteId")) : undefined;
  let newId: string | null = null;
  try {
    if (id && siteId) {
      await savePlace(id, siteId, parsed.place);
    } else {
      newId = await createPlace(parsed.place, userId, attach);
    }
  } catch (err) {
    return failure(err);
  }
  revalidatePath("/admin/places");
  if (newId) redirect(`/admin/places/${newId}?created=1`);
  return { ok: true, message: "Saved." };
}

/** Sites within the attach distance of a point, except the place's own site. */
export async function nearbySitesAction(lat: number, lng: number, exceptSiteId: string | null) {
  await assertAdmin();
  const point = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse({ lat, lng });
  return (await sitesNear(point.lat, point.lng)).filter((s) => s.siteId !== exceptSiteId);
}

export async function attachToSiteAction(placeId: string, fromSiteId: string, toSiteId: string): Promise<ActionResult> {
  await assertAdmin();
  try {
    await moveToSite(uuid.parse(placeId), uuid.parse(fromSiteId), uuid.parse(toSiteId));
  } catch (err) {
    return failure(err);
  }
  revalidatePath(`/admin/places/${placeId}`);
  return { ok: true, message: "Moved onto the existing site." };
}

export async function setVerifiedAction(placeId: string, verified: boolean): Promise<ActionResult> {
  await assertAdmin();
  try {
    await setVerified(uuid.parse(placeId), verified);
  } catch (err) {
    return failure(err);
  }
  revalidatePath(`/admin/places/${placeId}`);
  return { ok: true, message: verified ? "Marked verified." : "No longer verified." };
}

export async function setStatusAction(placeId: string, status: "draft" | "live" | "retired"): Promise<ActionResult> {
  await assertAdmin();
  const id = uuid.parse(placeId);
  if (status === "live") {
    const place = await getPlace(id);
    if (!place) return { ok: false, errors: ["That place no longer exists."] };
    const blockers = liveBlockers(place);
    if (blockers.length) return { ok: false, errors: [`Can't go live yet: it ${blockers.join(", ")}.`] };
  }
  try {
    await setStatus(id, z.enum(["draft", "live", "retired"]).parse(status));
  } catch (err) {
    return failure(err);
  }
  revalidatePath(`/admin/places/${placeId}`);
  revalidatePath("/admin");
  return { ok: true, message: status === "live" ? "It's live." : status === "retired" ? "Retired." : "Back to draft." };
}

export async function deleteDraftAction(placeId: string, siteId: string): Promise<ActionResult> {
  await assertAdmin();
  try {
    await deleteDraft(uuid.parse(placeId), uuid.parse(siteId));
  } catch (err) {
    return failure(err);
  }
  revalidatePath("/admin/places");
  redirect("/admin/places?deleted=1");
}

// ---------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------

export interface ImportPreviewRow {
  line: number;
  name: string;
  errors: string[];
  warnings: string[];
  nearby: NearbySite[];
}

export interface ImportPreview {
  fileErrors: string[];
  ignoredColumns: string[];
  rows: ImportPreviewRow[];
}

const MAX_CSV = 2_000_000;

/** The dry run: checks every row and writes nothing. */
export async function previewImportAction(text: string): Promise<ImportPreview> {
  await assertAdmin();
  if (typeof text !== "string" || text.length > MAX_CSV) {
    return { fileErrors: ["That file is too big. Split it into smaller files."], ignoredColumns: [], rows: [] };
  }
  const result = checkCsv(text, { allowTestNames: await allowsTestNames() });
  const names = result.rows.filter((r) => r.place).map((r) => r.name);
  const [taken, nearbyLists] = await Promise.all([
    existingNames(names),
    Promise.all(
      result.rows.map((r) =>
        r.place?.lat != null && r.place.lng != null ? sitesNear(r.place.lat, r.place.lng) : Promise.resolve([]),
      ),
    ),
  ]);
  return {
    fileErrors: result.fileErrors,
    ignoredColumns: result.ignoredColumns,
    rows: result.rows.map((r, i) => ({
      line: r.line,
      name: r.name,
      errors: r.errors,
      warnings: taken.has(r.name) ? [...r.warnings, "A place with this exact name already exists."] : r.warnings,
      nearby: nearbyLists[i],
    })),
  };
}

/** Imports every valid row as a draft. attach maps a line number to an existing site to share. */
export async function commitImportAction(
  text: string,
  attach: Record<number, string>,
): Promise<{ ok: true; created: number; skipped: number } | { ok: false; errors: string[] }> {
  const userId = await assertAdmin();
  if (typeof text !== "string" || text.length > MAX_CSV) return { ok: false, errors: ["That file is too big."] };
  const result = checkCsv(text, { allowTestNames: await allowsTestNames() });
  if (result.fileErrors.length) return { ok: false, errors: result.fileErrors };
  const valid = result.rows.filter((r) => r.place);
  const items = valid.map((r) => {
    const site = attach?.[r.line];
    return { place: r.place!, attachSiteId: site && uuid.safeParse(site).success ? site : undefined };
  });
  try {
    const created = await importPlaces(items, userId);
    revalidatePath("/admin");
    revalidatePath("/admin/places");
    return { ok: true, created, skipped: result.rows.length - valid.length };
  } catch (err) {
    const f = failure(err);
    return f.ok ? { ok: false, errors: ["Import failed."] } : f;
  }
}

// ---------------------------------------------------------------------------
// Puzzles
// ---------------------------------------------------------------------------

/** Fills every missing day from today through daysAhead, least recently used places first. */
export async function generateMissingAction(): Promise<ActionResult> {
  await assertAdmin();
  const today = puzzleDateFor(new Date());
  const dates = Array.from({ length: game.scheduling.daysAhead }, (_, i) => addDays(today, i));
  const [existing, pool] = await Promise.all([puzzlesBetween(dates[0], dates[dates.length - 1]), livePool()]);
  const have = new Set(existing.map((d) => d.date));
  const todo = dates.filter((d) => !have.has(d));
  if (todo.length === 0) return { ok: true, message: `All ${dates.length} days already have puzzles.` };

  let made = 0;
  try {
    for (const { date, rounds } of generateDays(pool, todo)) {
      await insertPuzzle(date, rounds);
      made++;
    }
  } catch (err) {
    await refreshLastUsed().catch(() => {});
    revalidatePath("/admin/puzzles");
    if (err instanceof NotEnoughPlacesError) {
      return {
        ok: false,
        errors: [
          `Made ${made} of ${todo.length} days, then ran out: ${err.message} Make more places live, then generate again.`,
        ],
      };
    }
    return failure(err);
  }
  await refreshLastUsed();
  revalidatePath("/admin/puzzles");
  revalidatePath("/admin");
  return { ok: true, message: `Made ${made} ${made === 1 ? "puzzle" : "puzzles"}.` };
}

const roundSchema = z.object({
  place_id: z.uuid(),
  mode: z.enum(["pin", "name"]),
  wrong_place_ids: z.array(z.uuid()).length(3).optional(),
});
const daySchema = z.array(roundSchema).length(game.roundsPerDay);
const dateSchema = z.iso.date();

/** Fresh wrong answers for one name round, from the live pool. Nothing is saved. */
export async function rerollWrongAnswersAction(
  date: string,
  rounds: GeneratedRound[],
  index: number,
): Promise<{ ok: true; wrong: string[] } | { ok: false; errors: string[] }> {
  await assertAdmin();
  const day = daySchema.safeParse(rounds);
  if (!dateSchema.safeParse(date).success || !day.success || !Number.isInteger(index)) {
    return { ok: false, errors: ["That day didn't send properly. Reload and try again."] };
  }
  try {
    const pool = await livePool();
    const wrong = wrongAnswersFor(
      pool,
      day.data[index].place_id,
      day.data.map((r) => r.place_id),
      `${date}:${index}:${Math.random()}`,
      day.data[index].wrong_place_ids ?? [],
    );
    return { ok: true, wrong };
  } catch (err) {
    if (err instanceof NotEnoughPlacesError) return { ok: false, errors: [err.message] };
    const f = failure(err);
    return f.ok ? { ok: false, errors: ["Couldn't re-roll."] } : f;
  }
}

/** Saves a future day's rounds. The database checks every scheduling rule. */
export async function savePuzzleDayAction(date: string, rounds: GeneratedRound[]): Promise<ActionResult> {
  await assertAdmin();
  const d = dateSchema.safeParse(date);
  const day = daySchema.safeParse(rounds);
  if (!d.success || !day.success) return { ok: false, errors: ["That day didn't send properly. Reload and try again."] };
  const cleaned = day.data.map((r) =>
    r.mode === "pin" ? { place_id: r.place_id, mode: "pin" as const } : { ...r, mode: "name" as const },
  );
  if (cleaned.some((r) => r.mode === "name" && !r.wrong_place_ids)) {
    return { ok: false, errors: ["Every name round needs three wrong answers. Press Re-roll on it."] };
  }
  try {
    await updatePuzzle(d.data, cleaned);
    await refreshLastUsed();
  } catch (err) {
    return failure(err);
  }
  revalidatePath("/admin/puzzles");
  revalidatePath(`/admin/puzzles/${date}`);
  return { ok: true, message: "Saved." };
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

const note = z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 1000) : null), z.string().nullable());

/** Approve: creates a draft place from the suggestion (on an existing site if chosen) and opens it. */
export async function approveSubmissionAction(formData: FormData): Promise<ActionResult> {
  const adminId = await assertAdmin();
  const id = uuid.parse(formData.get("id"));
  const siteRaw = formData.get("siteId");
  const siteId = typeof siteRaw === "string" && siteRaw ? uuid.parse(siteRaw) : undefined;
  const s = await getSubmission(id);
  if (!s || s.status !== "pending") return { ok: false, errors: ["That suggestion was already reviewed."] };

  let placeId: string;
  let photo: string | null = null;
  try {
    placeId = await createPlace(draftFromSubmission(s), adminId, siteId);
    photo = await photoForPlace(s);
    if (photo) await setPlacePhoto(placeId, photo);
    await markApproved(id, placeId, note.parse(formData.get("note")));
  } catch (err) {
    if (photo) await deletePhoto(photo).catch(() => {});
    return failure(err);
  }
  revalidatePath("/admin/submissions");
  revalidatePath("/admin");
  redirect(`/admin/places/${placeId}?created=1`);
}

export async function rejectSubmissionAction(formData: FormData): Promise<ActionResult> {
  await assertAdmin();
  try {
    await markRejected(uuid.parse(formData.get("id")), note.parse(formData.get("note")));
  } catch (err) {
    return failure(err);
  }
  revalidatePath("/admin/submissions");
  revalidatePath("/admin");
  return { ok: true, message: "Rejected." };
}

export async function duplicateSubmissionAction(formData: FormData): Promise<ActionResult> {
  await assertAdmin();
  const placeId = uuid.safeParse(formData.get("placeId"));
  if (!placeId.success) return { ok: false, errors: ["Choose the place it duplicates."] };
  try {
    await markDuplicate(uuid.parse(formData.get("id")), placeId.data, note.parse(formData.get("note")));
  } catch (err) {
    return failure(err);
  }
  revalidatePath("/admin/submissions");
  revalidatePath("/admin");
  return { ok: true, message: "Marked as a duplicate." };
}

// ---------------------------------------------------------------------------
// Place photos
// ---------------------------------------------------------------------------

export async function uploadPlacePhotoAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await assertAdmin();
  const placeId = uuid.parse(formData.get("placeId"));
  const photo = formData.get("photo");
  if (!(photo instanceof Blob) || photo.size === 0) return { ok: false, errors: ["Choose a photo."] };
  if (formData.get("photoRights") !== "on") {
    return { ok: false, errors: ["Confirm you took the photo or have permission to use it."] };
  }
  const place = await getPlace(placeId);
  if (!place) return { ok: false, errors: ["That place no longer exists."] };
  let path: string | null = null;
  try {
    path = await storePhoto("places", await cleanPhoto(Buffer.from(await photo.arrayBuffer())));
    await setPlacePhoto(placeId, path);
    if (place.photoPath) await deletePhoto(place.photoPath).catch(() => {});
  } catch (err) {
    if (path) await deletePhoto(path).catch(() => {});
    if (err instanceof BadPhotoError) return { ok: false, errors: [err.message] };
    return failure(err);
  }
  revalidatePath(`/admin/places/${placeId}`);
  return { ok: true, message: "Photo saved." };
}

export async function removePlacePhotoAction(placeId: string): Promise<ActionResult> {
  await assertAdmin();
  const place = await getPlace(uuid.parse(placeId));
  if (!place?.photoPath) return { ok: true };
  try {
    await setPlacePhoto(place.id, null);
    await deletePhoto(place.photoPath).catch(() => {});
  } catch (err) {
    return failure(err);
  }
  revalidatePath(`/admin/places/${placeId}`);
  return { ok: true, message: "Photo removed." };
}
