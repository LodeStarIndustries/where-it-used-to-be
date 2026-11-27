// The game's server-side rules: what today's puzzle looks like to a player, and
// how a guess is checked, scored and stored. Hard rule 2 lives here: a round's
// answer is only ever built for rounds the device has already submitted.
import { createHash } from "node:crypto";
import { game } from "@config/game";
import { daysBetween, puzzleDateFor, puzzleNumberFor } from "@/lib/puzzle-date";
import { distanceMeters, streetFromAddress } from "./geo";
import { namePoints, pinPoints, verdictFor } from "./scoring";
import type { GameStore, Owner, PlaceWithSite, StoredPlay, StoredPuzzle, StoredRound } from "./store";
import type { Answer, GuessInput, GuessResponse, PlayableRound, RoundResult, TodayResponse } from "./types";

/** Shared by every player: a stable order for a name round's four choices. */
function choiceOrder(date: string, roundIndex: number, placeId: string): string {
  return createHash("sha256").update(`${date}:${roundIndex}:${placeId}`).digest("hex");
}

function answerFor(place: PlaceWithSite): Answer {
  return {
    placeId: place.id,
    name: place.name,
    category: place.category,
    era: place.era,
    yearOpened: place.yearOpened,
    yearClosed: place.yearClosed,
    fact: place.fact,
    sources: place.sources,
    site: { lat: place.site.lat, lng: place.site.lng },
    currentUse: place.site.currentUse,
    street: streetFromAddress(place.site.addressText),
  };
}

/** Builds the playable version of each round. Only question fields, never answers. */
export function toPlayableRounds(puzzle: StoredPuzzle, places: Map<string, PlaceWithSite>): PlayableRound[] {
  return puzzle.rounds.map((round, index): PlayableRound => {
    const place = places.get(round.place_id);
    if (!place) throw new Error(`Puzzle ${puzzle.date} round ${index + 1}: place ${round.place_id} is missing`);
    if (round.mode === "pin") {
      return { index, mode: "pin", name: place.name, category: place.category, era: place.era };
    }
    const ids = [round.place_id, ...(round.wrong_place_ids ?? [])];
    const choices = ids
      .map((id) => {
        const p = places.get(id);
        if (!p) throw new Error(`Puzzle ${puzzle.date} round ${index + 1}: choice ${id} is missing`);
        return { id, name: p.name, order: choiceOrder(puzzle.date, index, id) };
      })
      .sort((a, b) => (a.order < b.order ? -1 : 1))
      .map(({ id, name }) => ({ id, name }));
    return {
      index,
      mode: "name",
      site: { lat: place.site.lat, lng: place.site.lng },
      currentUse: place.site.currentUse,
      choices,
    };
  });
}

function toResult(round: StoredRound, place: PlaceWithSite): RoundResult {
  const base = {
    index: round.roundIndex,
    mode: round.mode,
    points: round.points,
    verdict: verdictFor(round.points).key,
    answer: answerFor(place),
  };
  if (round.mode === "pin") {
    return { ...base, guess: { lat: round.guessLat!, lng: round.guessLng! }, distanceM: round.distanceM ?? 0 };
  }
  return { ...base, choiceId: round.choicePlaceId!, correct: round.choicePlaceId === place.id };
}

function allPlaceIds(puzzle: StoredPuzzle): string[] {
  return [...new Set(puzzle.rounds.flatMap((r) => [r.place_id, ...(r.wrong_place_ids ?? [])]))];
}

async function loadPlaces(store: GameStore, puzzle: StoredPuzzle) {
  const places = await store.getPlaces(allPlaceIds(puzzle));
  return new Map(places.map((p) => [p.id, p]));
}

/** Consecutive puzzle dates with a finished play, ending today or yesterday. */
export function streakFrom(completedDates: readonly string[], today: string): number {
  const dates = [...new Set(completedDates)].sort().reverse();
  if (dates.length === 0) return 0;
  const gap = daysBetween(dates[0], today);
  if (gap > 1 || gap < 0) return 0;
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    if (daysBetween(dates[i], dates[i - 1]) !== 1) break;
    streak++;
  }
  return streak;
}

/** Who is playing: a guest's device, and the account if they're signed in. */
export interface Player {
  deviceId: string | null;
  userId?: string | null;
}

const asPlayer = (who: Player | string | null): Player =>
  typeof who === "string" || who === null ? { deviceId: who, userId: null } : who;

/** A signed-in player's plays belong to the account; a guest's to the device. */
function ownerOf(player: Player): Owner | null {
  if (player.userId) return { userId: player.userId };
  if (player.deviceId) return { deviceId: player.deviceId };
  return null;
}

async function streakOf(store: GameStore, owner: Owner | null, today: string) {
  return owner ? streakFrom(await store.completedDates(owner), today) : 0;
}

function resultsFor(play: StoredPlay | null, puzzle: StoredPuzzle, places: Map<string, PlaceWithSite>) {
  if (!play) return [];
  return [...play.rounds]
    .sort((a, b) => a.roundIndex - b.roundIndex)
    .map((r) => toResult(r, places.get(puzzle.rounds[r.roundIndex].place_id)!));
}

export async function getToday(store: GameStore, who: Player | string | null, now = new Date()): Promise<TodayResponse> {
  const player = asPlayer(who);
  const date = puzzleDateFor(now);
  const number = puzzleNumberFor(date);
  const signedIn = Boolean(player.userId);
  // A signed-in player's guest plays on this device move to the account first.
  if (player.userId && player.deviceId) await store.linkDevice(player.deviceId, player.userId);
  const owner = ownerOf(player);

  // Independent reads run together; each is a round trip to the database.
  const [puzzle, streak, play] = await Promise.all([
    store.getPuzzle(date),
    streakOf(store, owner, date),
    owner ? store.getPlay(owner, date) : null,
  ]);

  if (!puzzle) {
    await store.logAdminEvent("no_puzzle", `No puzzle exists for ${date}`, { date });
    return { status: "none", date, number, streak, signedIn };
  }

  const completed = play?.rounds.length === game.roundsPerDay;
  const [places, rank] = await Promise.all([
    loadPlaces(store, puzzle),
    completed && player.userId ? store.rankOn(player.userId, date) : null,
  ]);
  const results = resultsFor(play, puzzle, places);
  return {
    status: "ok",
    date,
    number: puzzle.number,
    rounds: toPlayableRounds(puzzle, places),
    results,
    totalPoints: results.reduce((sum, r) => sum + r.points, 0),
    completed,
    streak,
    signedIn,
    rank,
  };
}

const error = (code: Extract<GuessResponse, { status: "error" }>["code"], message: string): GuessResponse => ({
  status: "error",
  code,
  message,
});

function inBounds(lat: number, lng: number) {
  const [[west, south], [east, north]] = game.map.bounds;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}

export async function submitGuess(
  store: GameStore,
  who: Player | string,
  input: GuessInput,
  now = new Date(),
): Promise<GuessResponse> {
  const player = asPlayer(who);
  const deviceId = player.deviceId;
  if (!deviceId) throw new Error("submitGuess needs a device ID");
  const userId = player.userId ?? null;
  const owner: Owner = userId ? { userId } : { deviceId };
  const today = puzzleDateFor(now);
  const age = daysBetween(input.puzzleDate, today);
  // Today's puzzle, or finishing yesterday's if it was started before midnight.
  if (age !== 0 && age !== 1) return error("wrong_day", "That puzzle has ended. Load today's puzzle.");

  // Independent reads run together; each is a round trip to the database.
  const [allowed, puzzle, existing] = await Promise.all([
    store.rateLimit(`guess:${deviceId}`, 60, game.rateLimits.guessesPerMinutePerDevice),
    store.getPuzzle(input.puzzleDate),
    store.getPlay(owner, input.puzzleDate),
  ]);
  if (!allowed) return error("rate_limited", "Too many guesses. Wait a minute and try again.");
  if (!puzzle) return error("no_puzzle", "There's no puzzle for that day.");
  if (age === 1 && !existing) return error("wrong_day", "That puzzle has ended. Load today's puzzle.");

  const played = existing?.rounds.length ?? 0;
  if (input.roundIndex < played) return error("already_played", "You've already played that round.");
  if (input.roundIndex !== played || input.roundIndex >= game.roundsPerDay) {
    return error("out_of_order", "Rounds are played in order.");
  }

  const round = puzzle.rounds[input.roundIndex];
  const places = await loadPlaces(store, puzzle);
  const place = places.get(round.place_id)!;

  let stored: StoredRound;
  if (round.mode === "pin") {
    const { lat, lng } = input;
    if (typeof lat !== "number" || typeof lng !== "number" || !inBounds(lat, lng)) {
      return error("bad_guess", "Drop your pin inside the map area.");
    }
    const distance = Math.round(distanceMeters({ lat, lng }, place.site));
    stored = {
      roundIndex: input.roundIndex,
      mode: "pin",
      guessLat: lat,
      guessLng: lng,
      choicePlaceId: null,
      distanceM: distance,
      points: pinPoints(distance),
    };
  } else {
    const allowed = [round.place_id, ...(round.wrong_place_ids ?? [])];
    if (!input.choiceId || !allowed.includes(input.choiceId)) {
      return error("bad_guess", "Pick one of the four choices.");
    }
    stored = {
      roundIndex: input.roundIndex,
      mode: "name",
      guessLat: null,
      guessLng: null,
      choicePlaceId: input.choiceId,
      distanceM: null,
      points: namePoints(input.choiceId === round.place_id),
    };
  }

  if (!existing) await store.ensureDevice(deviceId);
  const play = existing ?? (await store.startPlay(deviceId, userId, input.puzzleDate));
  const earlier = play.rounds.filter((r) => r.roundIndex < input.roundIndex).reduce((sum, r) => sum + r.points, 0);
  if (!(await store.insertRound(play.id, stored))) {
    return error("already_played", "You've already played that round.");
  }

  const total = earlier + stored.points;
  const completed = input.roundIndex === game.roundsPerDay - 1;
  await store.updatePlay(play.id, total, completed ? now.toISOString() : null);

  if (completed && userId) await store.refreshStreaks(userId);
  const [streak, rank] = await Promise.all([
    streakOf(store, owner, today),
    completed && userId ? store.rankOn(userId, input.puzzleDate) : null,
  ]);
  return { status: "ok", result: toResult(stored, place), totalPoints: total, completed, streak, rank };
}
