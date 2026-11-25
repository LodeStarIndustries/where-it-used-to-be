import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeneratedRound } from "./generator";
import type { GameStore, PlaceWithSite, StoredPlay, StoredRound } from "./store";
import type { Source } from "./types";

// Reads and writes game data with the server's secret key (Row Level Security is
// bypassed, so every rule is enforced in service.ts and by the database triggers).

interface PlaceRow {
  id: string;
  name: string;
  category: PlaceWithSite["category"];
  era: PlaceWithSite["era"];
  year_opened: number | null;
  year_closed: number | null;
  fact: string | null;
  sources: Source[];
  sites: { id: string; lat: number; lng: number; current_use: string | null; address_text: string | null };
}

interface RoundRow {
  round_index: number;
  mode: StoredRound["mode"];
  guess_lat: number | null;
  guess_lng: number | null;
  choice_place_id: string | null;
  distance_m: number | null;
  points: number;
}

const roundFromRow = (r: RoundRow): StoredRound => ({
  roundIndex: r.round_index,
  mode: r.mode,
  guessLat: r.guess_lat,
  guessLng: r.guess_lng,
  choicePlaceId: r.choice_place_id,
  distanceM: r.distance_m,
  points: r.points,
});

function check<T>(result: { data: T; error: { message: string; code?: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
}

export function supabaseGameStore(db: SupabaseClient): GameStore {
  const playSelect = "id, total_points, completed_at, play_rounds (round_index, mode, guess_lat, guess_lng, choice_place_id, distance_m, points)";
  const toPlay = (row: {
    id: string;
    total_points: number;
    completed_at: string | null;
    play_rounds: RoundRow[];
  }): StoredPlay => ({
    id: row.id,
    totalPoints: row.total_points,
    completedAt: row.completed_at,
    rounds: row.play_rounds.map(roundFromRow),
  });

  return {
    async getPuzzle(date) {
      const row = check(
        await db.from("daily_puzzles").select("puzzle_date, number, rounds").eq("puzzle_date", date).maybeSingle(),
        "Reading the puzzle",
      );
      return row ? { date: row.puzzle_date, number: row.number, rounds: row.rounds as GeneratedRound[] } : null;
    },

    async getPlaces(ids) {
      if (ids.length === 0) return [];
      const rows = check(
        await db
          .from("places")
          .select("id, name, category, era, year_opened, year_closed, fact, sources, sites!inner (id, lat, lng, current_use, address_text)")
          .in("id", ids),
        "Reading places",
      ) as unknown as PlaceRow[];
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        era: r.era,
        yearOpened: r.year_opened,
        yearClosed: r.year_closed,
        fact: r.fact,
        sources: r.sources ?? [],
        site: {
          id: r.sites.id,
          lat: r.sites.lat,
          lng: r.sites.lng,
          currentUse: r.sites.current_use,
          addressText: r.sites.address_text,
        },
      }));
    },

    async getDevicePlay(deviceId, date) {
      const row = check(
        await db.from("plays").select(playSelect).eq("device_id", deviceId).eq("puzzle_date", date).maybeSingle(),
        "Reading the play",
      );
      return row ? toPlay(row) : null;
    },

    async ensureDevice(deviceId) {
      check(
        await db.from("devices").upsert({ id: deviceId, last_seen_at: new Date().toISOString() }, { onConflict: "id" }),
        "Saving the device",
      );
    },

    async startPlay(deviceId, date) {
      const inserted = await db
        .from("plays")
        .insert({ device_id: deviceId, puzzle_date: date })
        .select(playSelect)
        .single();
      if (!inserted.error) return toPlay(inserted.data);
      if (inserted.error.code !== "23505") throw new Error(`Starting the play: ${inserted.error.message}`);
      // Another request started it first.
      const existing = await this.getDevicePlay(deviceId, date);
      if (!existing) throw new Error("Starting the play: conflict but no play found");
      return existing;
    },

    async insertRound(playId, round) {
      const { error } = await db.from("play_rounds").insert({
        play_id: playId,
        round_index: round.roundIndex,
        mode: round.mode,
        guess_lat: round.guessLat,
        guess_lng: round.guessLng,
        choice_place_id: round.choicePlaceId,
        distance_m: round.distanceM,
        points: round.points,
      });
      if (!error) return true;
      if (error.code === "23505") return false;
      throw new Error(`Saving the round: ${error.message}`);
    },

    async updatePlay(playId, totalPoints, completedAt) {
      check(
        await db.from("plays").update({ total_points: totalPoints, completed_at: completedAt }).eq("id", playId),
        "Updating the play",
      );
    },

    async completedDates(deviceId) {
      const rows = check(
        await db
          .from("plays")
          .select("puzzle_date")
          .eq("device_id", deviceId)
          .not("completed_at", "is", null)
          .order("puzzle_date", { ascending: false })
          .limit(400),
        "Reading the streak",
      );
      return (rows ?? []).map((r) => r.puzzle_date as string);
    },

    async rateLimit(key, windowSeconds, max) {
      const data = check(
        await db.rpc("rate_limit_hit", { p_key: key, p_window_seconds: windowSeconds, p_max: max }),
        "Rate limit",
      );
      return data === true;
    },

    async logAdminEvent(kind, message, details) {
      // One open event per kind and message is enough; don't fill the table on every page view.
      const open = await db
        .from("admin_events")
        .select("id")
        .eq("kind", kind)
        .eq("message", message)
        .is("resolved_at", null)
        .limit(1);
      if (open.data && open.data.length > 0) return;
      await db.from("admin_events").insert({ kind, message, details });
    },
  };
}
