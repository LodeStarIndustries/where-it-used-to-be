import "server-only";
// Admin reads and writes, with the server's secret key. Callers must check
// assertAdmin() / requireAdminPage() first; nothing here checks it again.
import type { SupabaseClient } from "@supabase/supabase-js";
import { game, type Category, type Era } from "@config/game";
import { addDays, puzzleDateFor, puzzleNumberFor } from "@/lib/puzzle-date";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GeneratedRound } from "@/lib/game/generator";
import type { PlaceInput, SourceInput } from "./place-schema";
import type { ExistingPlace } from "./sync";

export function db(): SupabaseClient {
  const client = createAdminClient();
  if (!client) throw new Error("Supabase is not configured");
  return client;
}

export function check<T>(result: { data: T; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
}

export type PlaceStatus = "draft" | "live" | "retired";

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardStats {
  live: number;
  draft: number;
  retired: number;
  needsPin: number;
  readyToGoLive: number;
  pendingSubmissions: number;
  neverUsedLive: number;
  scheduledThrough: string | null;
  nextDays: { date: string; number: number; ready: boolean }[];
  openEvents: { id: number; kind: string; message: string; createdAt: string }[];
}

export async function dashboardStats(): Promise<DashboardStats> {
  const client = db();
  const today = puzzleDateFor(new Date());
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>, what: string) => {
    const r = await q;
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
    return r.count ?? 0;
  };
  const head = { count: "exact" as const, head: true };

  const [live, draft, retired, needsPin, ready, pending, neverUsed, scheduled, upcoming, events] = await Promise.all([
    count(client.from("places").select("id", head).eq("status", "live"), "Counting live places"),
    count(client.from("places").select("id", head).eq("status", "draft"), "Counting drafts"),
    count(client.from("places").select("id", head).eq("status", "retired"), "Counting retired"),
    count(
      client.from("places").select("id, sites!inner(lat)", head).eq("status", "draft").is("sites.lat", null),
      "Counting places that need pins",
    ),
    count(
      client
        .from("places")
        .select("id, sites!inner(lat)", head)
        .eq("status", "draft")
        .not("sites.lat", "is", null)
        .not("verified_at", "is", null)
        .not("difficulty", "is", null),
      "Counting ready drafts",
    ),
    count(client.from("submissions").select("id", head).eq("status", "pending"), "Counting submissions"),
    count(client.from("places").select("id", head).eq("status", "live").is("last_used_on", null), "Counting unused"),
    client.from("daily_puzzles").select("puzzle_date").gte("puzzle_date", today).order("puzzle_date", { ascending: false }).limit(1),
    client.from("daily_puzzles").select("puzzle_date").in("puzzle_date", week),
    client
      .from("admin_events")
      .select("id, kind, message, created_at")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const have = new Set((check(upcoming, "Reading puzzles") ?? []).map((r) => r.puzzle_date as string));
  return {
    live,
    draft,
    retired,
    needsPin,
    readyToGoLive: ready,
    pendingSubmissions: pending,
    neverUsedLive: neverUsed,
    scheduledThrough: (check(scheduled, "Reading puzzles") ?? [])[0]?.puzzle_date ?? null,
    nextDays: week.map((date) => ({ date, number: puzzleNumberFor(date), ready: have.has(date) })),
    openEvents: (check(events, "Reading events") ?? []).map((e) => ({
      id: e.id,
      kind: e.kind,
      message: e.message,
      createdAt: e.created_at,
    })),
  };
}

export async function resolveEvent(id: number) {
  check(await db().from("admin_events").update({ resolved_at: new Date().toISOString() }).eq("id", id), "Resolving");
}

// ---------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------

export interface PlaceFilters {
  q?: string;
  status?: PlaceStatus;
  era?: Era | "none";
  category?: Category;
  needsPin?: boolean;
  missingFact?: boolean;
  missingSource?: boolean;
  /** Drafts that pass every go-live rule. */
  ready?: boolean;
  page?: number;
}

export interface PlaceRow {
  id: string;
  name: string;
  category: Category;
  era: Era | null;
  status: PlaceStatus;
  verified: boolean;
  difficulty: number | null;
  hasPin: boolean;
  hasFact: boolean;
  sourceCount: number;
  addressText: string | null;
  neighbourhood: string | null;
  lastUsedOn: string | null;
}

export const PAGE_SIZE = 50;

export async function listPlaces(f: PlaceFilters): Promise<{ rows: PlaceRow[]; total: number }> {
  let q = db()
    .from("places")
    .select(
      "id, name, category, era, status, verified_at, difficulty, fact, sources, last_used_on, sites!inner(lat, address_text, neighbourhood)",
      { count: "exact" },
    );
  if (f.q) q = q.ilike("name", `%${f.q.replace(/[%_,()]/g, " ")}%`);
  if (f.status) q = q.eq("status", f.status);
  if (f.era === "none") q = q.is("era", null);
  else if (f.era) q = q.eq("era", f.era);
  if (f.category) q = q.eq("category", f.category);
  if (f.needsPin) q = q.is("sites.lat", null);
  if (f.missingFact) q = q.or("fact.is.null,fact.eq.");
  if (f.missingSource) q = q.eq("sources", "[]");
  if (f.ready) q = q.not("sites.lat", "is", null).not("verified_at", "is", null).not("difficulty", "is", null);
  const page = Math.max(0, f.page ?? 0);
  const result = await q.order("name").range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  const rows = check(result, "Listing places") as unknown as {
    id: string;
    name: string;
    category: Category;
    era: Era | null;
    status: PlaceStatus;
    verified_at: string | null;
    difficulty: number | null;
    fact: string | null;
    sources: SourceInput[];
    last_used_on: string | null;
    sites: { lat: number | null; address_text: string | null; neighbourhood: string | null };
  }[];
  return {
    total: result.count ?? rows.length,
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      era: r.era,
      status: r.status,
      verified: r.verified_at !== null,
      difficulty: r.difficulty,
      hasPin: r.sites.lat !== null,
      hasFact: Boolean(r.fact?.trim()),
      sourceCount: r.sources?.length ?? 0,
      addressText: r.sites.address_text,
      neighbourhood: r.sites.neighbourhood,
      lastUsedOn: r.last_used_on,
    })),
  };
}

export interface PlaceDetail extends PlaceInput {
  id: string;
  siteId: string;
  status: PlaceStatus;
  verifiedAt: string | null;
  lastUsedOn: string | null;
  photoPath: string | null;
  photoRightsConfirmed: boolean;
  /** Other places sharing this site (site fields are shared with them). */
  siteSiblings: { id: string; name: string }[];
}

export async function getPlace(id: string): Promise<PlaceDetail | null> {
  const row = check(
    await db()
      .from("places")
      .select(
        "id, site_id, name, category, era, year_opened, year_closed, fact, sources, difficulty, status, verified_at, last_used_on, photo_path, photo_rights_confirmed, sites!inner(id, lat, lng, address_text, neighbourhood, current_use, notes, places(id, name))",
      )
      .eq("id", id)
      .maybeSingle(),
    "Reading the place",
  ) as unknown as {
    id: string;
    site_id: string;
    name: string;
    category: Category;
    era: Era | null;
    year_opened: number | null;
    year_closed: number | null;
    fact: string | null;
    sources: SourceInput[];
    difficulty: 1 | 2 | 3 | null;
    status: PlaceStatus;
    verified_at: string | null;
    last_used_on: string | null;
    photo_path: string | null;
    photo_rights_confirmed: boolean;
    sites: {
      id: string;
      lat: number | null;
      lng: number | null;
      address_text: string | null;
      neighbourhood: string | null;
      current_use: string | null;
      notes: string | null;
      places: { id: string; name: string }[];
    };
  } | null;
  if (!row) return null;
  return {
    id: row.id,
    siteId: row.site_id,
    name: row.name,
    category: row.category,
    era: row.era,
    yearOpened: row.year_opened,
    yearClosed: row.year_closed,
    fact: row.fact,
    sources: row.sources ?? [],
    difficulty: row.difficulty,
    status: row.status,
    verifiedAt: row.verified_at,
    lastUsedOn: row.last_used_on,
    photoPath: row.photo_path,
    photoRightsConfirmed: row.photo_rights_confirmed,
    lat: row.sites.lat,
    lng: row.sites.lng,
    addressText: row.sites.address_text,
    neighbourhood: row.sites.neighbourhood,
    currentUse: row.sites.current_use,
    notes: row.sites.notes,
    siteSiblings: row.sites.places.filter((p) => p.id !== row.id),
  };
}

const siteColumns = (p: PlaceInput) => ({
  lat: p.lat,
  lng: p.lng,
  address_text: p.addressText,
  neighbourhood: p.neighbourhood,
  current_use: p.currentUse,
  notes: p.notes,
});

const placeColumns = (p: PlaceInput) => ({
  name: p.name,
  category: p.category,
  era: p.era,
  year_opened: p.yearOpened,
  year_closed: p.yearClosed,
  fact: p.fact,
  difficulty: p.difficulty,
  sources: p.sources,
});

/** Creates a draft place on a new site, or on an existing site when siteId is given. */
export async function createPlace(p: PlaceInput, createdBy: string | null, siteId?: string): Promise<string> {
  const client = db();
  let site = siteId;
  if (!site) {
    site = (check(await client.from("sites").insert(siteColumns(p)).select("id").single(), "Creating the site") as { id: string }).id;
  }
  const created = await client
    .from("places")
    .insert({ ...placeColumns(p), site_id: site, status: "draft", created_by: createdBy })
    .select("id")
    .single();
  if (created.error && !siteId) await client.from("sites").delete().eq("id", site); // don't leave an empty site
  return (check(created, "Creating the place") as { id: string }).id;
}

/** Saves the place's own fields and its site's fields (shared with any sibling places). */
export async function savePlace(id: string, siteId: string, p: PlaceInput) {
  const client = db();
  check(await client.from("sites").update(siteColumns(p)).eq("id", siteId), "Saving the site");
  check(await client.from("places").update(placeColumns(p)).eq("id", id), "Saving the place");
}

export async function setVerified(id: string, verified: boolean) {
  check(
    await db().from("places").update({ verified_at: verified ? new Date().toISOString() : null }).eq("id", id),
    "Saving verified",
  );
}

export async function setStatus(id: string, status: PlaceStatus) {
  check(await db().from("places").update({ status }).eq("id", id), "Changing the status");
}

/** Moves the place onto another site. Deletes its old site if nothing else is there. */
export async function moveToSite(id: string, fromSiteId: string, toSiteId: string) {
  const client = db();
  check(await client.from("places").update({ site_id: toSiteId }).eq("id", id), "Moving the place");
  const left = check(await client.from("places").select("id").eq("site_id", fromSiteId).limit(1), "Checking the old site");
  if ((left ?? []).length === 0) await client.from("sites").delete().eq("id", fromSiteId);
}

/** Deletes a draft that was never used. Its site goes too if nothing else is there. */
export async function deleteDraft(id: string, siteId: string) {
  const client = db();
  check(await client.from("places").delete().eq("id", id).eq("status", "draft"), "Deleting the draft");
  const left = check(await client.from("places").select("id").eq("site_id", siteId).limit(1), "Checking the site");
  if ((left ?? []).length === 0) await client.from("sites").delete().eq("id", siteId);
}

export async function setPlacePhoto(id: string, path: string | null) {
  check(
    await db()
      .from("places")
      .update({ photo_path: path, photo_rights_confirmed: path !== null })
      .eq("id", id),
    "Saving the photo",
  );
}

export interface NearbySite {
  siteId: string;
  distanceM: number;
  addressText: string | null;
  placeNames: string[];
}

export async function sitesNear(lat: number, lng: number, meters = game.attachToSiteWithinMeters): Promise<NearbySite[]> {
  const rows = check(
    await db().rpc("sites_near", { p_lat: lat, p_lng: lng, p_meters: meters }),
    "Finding nearby sites",
  ) as { site_id: string; distance_m: number; address_text: string | null; place_names: string[] }[];
  return (rows ?? []).map((r) => ({
    siteId: r.site_id,
    distanceM: Math.round(r.distance_m),
    addressText: r.address_text,
    placeNames: r.place_names,
  }));
}

/** Every site with a pin, for showing existing pins on the admin map. */
export async function pinnedSites(): Promise<{ id: string; lat: number; lng: number; names: string[] }[]> {
  const rows = check(
    await db().from("sites").select("id, lat, lng, places(name)").not("lat", "is", null),
    "Reading sites",
  ) as unknown as { id: string; lat: number; lng: number; places: { name: string }[] }[];
  return rows.map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, names: r.places.map((p) => p.name) }));
}

// ---------------------------------------------------------------------------
// Puzzles
// ---------------------------------------------------------------------------

export interface PoolRow {
  id: string;
  siteId: string;
  name: string;
  category: Category;
  era: Era | null;
  difficulty: number;
  lastUsedOn: string | null;
}

/** Every live place: the scheduling pool. */
export async function livePool(): Promise<PoolRow[]> {
  const rows = check(
    await db().from("places").select("id, site_id, name, category, era, difficulty, last_used_on").eq("status", "live"),
    "Reading live places",
  ) as { id: string; site_id: string; name: string; category: Category; era: Era | null; difficulty: number; last_used_on: string | null }[];
  return rows.map((r) => ({
    id: r.id,
    siteId: r.site_id,
    name: r.name,
    category: r.category,
    era: r.era,
    difficulty: r.difficulty,
    lastUsedOn: r.last_used_on,
  }));
}

export interface StoredDay {
  date: string;
  number: number;
  locked: boolean;
  rounds: GeneratedRound[];
}

export async function puzzlesBetween(from: string, to: string): Promise<StoredDay[]> {
  const rows = check(
    await db()
      .from("daily_puzzles")
      .select("puzzle_date, number, locked, rounds")
      .gte("puzzle_date", from)
      .lte("puzzle_date", to)
      .order("puzzle_date"),
    "Reading puzzles",
  ) as { puzzle_date: string; number: number; locked: boolean; rounds: GeneratedRound[] }[];
  return rows.map((r) => ({ date: r.puzzle_date, number: r.number, locked: r.locked, rounds: r.rounds }));
}

export async function placeNames(ids: string[]): Promise<Map<string, { name: string; category: Category; era: Era | null }>> {
  if (ids.length === 0) return new Map();
  const rows = check(
    await db().from("places").select("id, name, category, era").in("id", [...new Set(ids)]),
    "Reading place names",
  ) as { id: string; name: string; category: Category; era: Era | null }[];
  return new Map(rows.map((r) => [r.id, { name: r.name, category: r.category, era: r.era }]));
}

export async function insertPuzzle(date: string, rounds: GeneratedRound[]) {
  check(
    await db().from("daily_puzzles").insert({ puzzle_date: date, number: puzzleNumberFor(date), rounds }),
    `Saving the puzzle for ${date}`,
  );
}

/** Replaces a future day's rounds. The database refuses days that have started. */
export async function updatePuzzle(date: string, rounds: GeneratedRound[]) {
  check(await db().from("daily_puzzles").update({ rounds }).eq("puzzle_date", date), `Saving ${date}`);
}

export async function refreshLastUsed() {
  check(await db().rpc("refresh_last_used"), "Updating last used dates");
}

// ---------------------------------------------------------------------------
// CSV import and export
// ---------------------------------------------------------------------------

/** Whether this database accepts TEST: names (only the development database does). */
export async function allowsTestNames(): Promise<boolean> {
  const row = check(
    await db().from("app_settings").select("environment").maybeSingle(),
    "Reading the database environment",
  ) as { environment: string } | null;
  return row?.environment === "development";
}

/** Creates drafts in bulk: new sites for rows without attachSiteId, then the places. */
export async function importPlaces(items: { place: PlaceInput; attachSiteId?: string }[], createdBy: string): Promise<number> {
  if (items.length === 0) return 0;
  const client = db();
  const needSite = items.filter((i) => !i.attachSiteId);
  const siteIds: string[] = [];
  if (needSite.length) {
    const created = check(
      await client.from("sites").insert(needSite.map((i) => siteColumns(i.place))).select("id"),
      "Creating sites",
    ) as { id: string }[];
    siteIds.push(...created.map((s) => s.id));
  }
  let next = 0;
  const rows = items.map((i) => ({
    ...placeColumns(i.place),
    site_id: i.attachSiteId ?? siteIds[next++],
    status: "draft",
    created_by: createdBy,
  }));
  const inserted = await client.from("places").insert(rows).select("id");
  if (inserted.error) {
    // Don't leave the new, empty sites behind.
    if (siteIds.length) await client.from("sites").delete().in("id", siteIds);
    throw new Error(`Creating places: ${inserted.error.message}`);
  }
  return (inserted.data ?? []).length;
}

/** Every place, with its site, for the CSV export. */
export async function allPlacesForExport(): Promise<PlaceInput[]> {
  const rows = check(
    await db()
      .from("places")
      .select("name, category, era, year_opened, year_closed, fact, difficulty, sources, sites!inner(lat, lng, address_text, neighbourhood, current_use, notes)")
      .order("name"),
    "Reading places",
  ) as unknown as {
    name: string;
    category: Category;
    era: Era | null;
    year_opened: number | null;
    year_closed: number | null;
    fact: string | null;
    difficulty: 1 | 2 | 3 | null;
    sources: SourceInput[];
    sites: { lat: number | null; lng: number | null; address_text: string | null; neighbourhood: string | null; current_use: string | null; notes: string | null };
  }[];
  return rows.map((r) => ({
    name: r.name,
    category: r.category,
    era: r.era,
    yearOpened: r.year_opened,
    yearClosed: r.year_closed,
    fact: r.fact,
    difficulty: r.difficulty,
    sources: r.sources ?? [],
    lat: r.sites.lat,
    lng: r.sites.lng,
    addressText: r.sites.address_text,
    neighbourhood: r.sites.neighbourhood,
    currentUse: r.sites.current_use,
    notes: r.sites.notes,
  }));
}

/** Every place with its id and site, for matching re-imported sheet rows. */
export async function placesForSync(): Promise<ExistingPlace[]> {
  const rows = check(
    await db()
      .from("places")
      .select(
        "id, site_id, name, category, era, year_opened, year_closed, fact, difficulty, sources, sites!inner(lat, lng, address_text, neighbourhood, current_use, notes, places(id, name))",
      ),
    "Reading places",
  ) as unknown as {
    id: string;
    site_id: string;
    name: string;
    category: Category;
    era: Era | null;
    year_opened: number | null;
    year_closed: number | null;
    fact: string | null;
    difficulty: 1 | 2 | 3 | null;
    sources: SourceInput[];
    sites: {
      lat: number | null;
      lng: number | null;
      address_text: string | null;
      neighbourhood: string | null;
      current_use: string | null;
      notes: string | null;
      places: { id: string; name: string }[];
    };
  }[];
  return rows.map((r) => ({
    id: r.id,
    siteId: r.site_id,
    siteSiblings: r.sites.places.filter((p) => p.id !== r.id).map((p) => p.name),
    place: {
      name: r.name,
      category: r.category,
      era: r.era,
      yearOpened: r.year_opened,
      yearClosed: r.year_closed,
      fact: r.fact,
      difficulty: r.difficulty,
      sources: r.sources ?? [],
      lat: r.sites.lat,
      lng: r.sites.lng,
      addressText: r.sites.address_text,
      neighbourhood: r.sites.neighbourhood,
      currentUse: r.sites.current_use,
      notes: r.sites.notes,
    },
  }));
}

/** Applies re-imported changes to existing places. Status and verification are left alone. */
export async function updatePlaces(items: { id: string; siteId: string; place: PlaceInput }[]): Promise<number> {
  for (const i of items) await savePlace(i.id, i.siteId, i.place);
  return items.length;
}
