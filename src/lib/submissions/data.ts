import "server-only";
// Player suggestions ("Suggest a place") and the admin review queue. Server-side
// with the secret key; callers check the session (players) or assertAdmin().
import type { Category, Era } from "@config/game";
import { check, db, type PlaceDetail } from "@/lib/admin/data";
import type { PlaceInput } from "@/lib/admin/place-schema";
import { copyPhoto } from "@/lib/photos";

export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface NewSubmission {
  businessName: string;
  category: Category;
  lat: number;
  lng: number;
  addressText: string | null;
  currentUse: string | null;
  yearsText: string | null;
  era: Era | null;
  memory: string | null;
  photoPath: string | null;
}

export async function createSubmission(userId: string, s: NewSubmission): Promise<string> {
  const row = check(
    await db()
      .from("submissions")
      .insert({
        user_id: userId,
        business_name: s.businessName,
        category: s.category,
        lat: s.lat,
        lng: s.lng,
        address_text: s.addressText,
        current_use: s.currentUse,
        years_text: s.yearsText,
        era: s.era,
        memory: s.memory,
        photo_path: s.photoPath,
        photo_rights_confirmed: s.photoPath !== null,
        confirmed_not_residence: true,
      })
      .select("id")
      .single(),
    "Saving the suggestion",
  ) as { id: string };
  return row.id;
}

export interface MySubmission {
  id: string;
  businessName: string;
  status: SubmissionStatus;
  createdAt: string;
}

export async function mySubmissions(userId: string): Promise<MySubmission[]> {
  const rows = check(
    await db()
      .from("submissions")
      .select("id, business_name, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    "Reading your suggestions",
  ) as { id: string; business_name: string; status: SubmissionStatus; created_at: string }[];
  return rows.map((r) => ({ id: r.id, businessName: r.business_name, status: r.status, createdAt: r.created_at }));
}

export interface SubmissionDetail {
  id: string;
  businessName: string;
  category: Category;
  lat: number;
  lng: number;
  addressText: string | null;
  currentUse: string | null;
  yearsText: string | null;
  era: Era | null;
  memory: string | null;
  photoPath: string | null;
  status: SubmissionStatus;
  adminNote: string | null;
  placeId: string | null;
  submittedBy: string;
  createdAt: string;
  reviewedAt: string | null;
}

const detailSelect =
  "id, business_name, category, lat, lng, address_text, current_use, years_text, era, memory, photo_path, status, admin_note, place_id, created_at, reviewed_at, profiles(display_name)";

type DetailRow = {
  id: string;
  business_name: string;
  category: Category;
  lat: number;
  lng: number;
  address_text: string | null;
  current_use: string | null;
  years_text: string | null;
  era: Era | null;
  memory: string | null;
  photo_path: string | null;
  status: SubmissionStatus;
  admin_note: string | null;
  place_id: string | null;
  created_at: string;
  reviewed_at: string | null;
  profiles: { display_name: string | null } | null;
};

const toDetail = (r: DetailRow): SubmissionDetail => ({
  id: r.id,
  businessName: r.business_name,
  category: r.category,
  lat: r.lat,
  lng: r.lng,
  addressText: r.address_text,
  currentUse: r.current_use,
  yearsText: r.years_text,
  era: r.era,
  memory: r.memory,
  photoPath: r.photo_path,
  status: r.status,
  adminNote: r.admin_note,
  placeId: r.place_id,
  submittedBy: r.profiles?.display_name ?? "A player",
  createdAt: r.created_at,
  reviewedAt: r.reviewed_at,
});

/** The queue: pending first, oldest first. */
export async function pendingSubmissions(): Promise<SubmissionDetail[]> {
  const rows = check(
    await db().from("submissions").select(detailSelect).eq("status", "pending").order("created_at").limit(100),
    "Reading the queue",
  ) as unknown as DetailRow[];
  return rows.map(toDetail);
}

export async function reviewedSubmissions(): Promise<SubmissionDetail[]> {
  const rows = check(
    await db()
      .from("submissions")
      .select(detailSelect)
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false })
      .limit(50),
    "Reading reviewed suggestions",
  ) as unknown as DetailRow[];
  return rows.map(toDetail);
}

export async function getSubmission(id: string): Promise<SubmissionDetail | null> {
  const row = check(
    await db().from("submissions").select(detailSelect).eq("id", id).maybeSingle(),
    "Reading the suggestion",
  ) as unknown as DetailRow | null;
  return row ? toDetail(row) : null;
}

/** The draft a submission becomes. Years and the memory go into admin notes for Mike to work from. */
export function draftFromSubmission(s: SubmissionDetail): PlaceInput {
  const notes = [
    `Suggested by ${s.submittedBy} on ${s.createdAt.slice(0, 10)}.`,
    s.yearsText ? `Open: ${s.yearsText}.` : null,
    s.memory ? `Memory: ${s.memory}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    name: s.businessName,
    category: s.category,
    addressText: s.addressText,
    lat: s.lat,
    lng: s.lng,
    currentUse: s.currentUse,
    neighbourhood: null,
    yearOpened: null,
    yearClosed: null,
    era: s.era,
    fact: null,
    difficulty: null,
    sources: [],
    notes: notes.slice(0, 2000),
  };
}

/** Marks the submission reviewed. Only pending ones change, so a double click can't approve twice. */
async function review(id: string, status: "approved" | "rejected", note: string | null, placeId: string | null) {
  const rows = check(
    await db()
      .from("submissions")
      .update({ status, admin_note: note, place_id: placeId, reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending")
      .select("id"),
    "Saving the review",
  ) as { id: string }[];
  if (rows.length === 0) throw new Error("That suggestion was already reviewed.");
}

/** Copies the submission's photo for a new draft place. */
export async function photoForPlace(s: SubmissionDetail): Promise<string | null> {
  return s.photoPath ? copyPhoto(s.photoPath, "places") : null;
}

export async function markApproved(id: string, placeId: string, note: string | null) {
  await review(id, "approved", note, placeId);
}

export async function markRejected(id: string, note: string | null) {
  await review(id, "rejected", note, null);
}

export async function markDuplicate(id: string, placeId: string, note: string | null) {
  await review(id, "rejected", note ? `Duplicate. ${note}` : "Duplicate of an existing place.", placeId);
}

/** Names of every place, for the "duplicate of" picker. */
export async function placeChoices(): Promise<{ id: string; name: string; status: PlaceDetail["status"] }[]> {
  const rows = check(await db().from("places").select("id, name, status").order("name"), "Reading places") as {
    id: string;
    name: string;
    status: PlaceDetail["status"];
  }[];
  return rows;
}
