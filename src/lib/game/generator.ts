// The puzzle generator: picks each day's five rounds from the live places.
// Pure (no database access), so the rules are easy to test. The scheduling rules:
// - least recently used places first, so nothing repeats until the pool is used up;
// - no two rounds in a day share a site;
// - rounds sorted easy to hard by difficulty, then given the daily mix of modes;
// - name rounds get three wrong answers from other sites, preferring the same
//   category and era so the choice is hard.
import { game, type Category, type Era, type RoundMode } from "@config/game";

export interface PoolPlace {
  id: string;
  siteId: string;
  category: Category;
  era: Era | null;
  difficulty: number;
  /** YYYY-MM-DD, or null if never used. */
  lastUsedOn: string | null;
}

export interface GeneratedRound {
  place_id: string;
  mode: RoundMode;
  wrong_place_ids?: string[];
}

export class NotEnoughPlacesError extends Error {}

/** Deterministic random numbers from a string seed (mulberry32 over an FNV-1a hash). */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generates one day's rounds. Doesn't change `pool`. */
export function generateDay(pool: readonly PoolPlace[], date: string): GeneratedRound[] {
  const rand = seededRandom(`wiutb:${date}`);
  const shuffled = pool.map((p) => ({ p, r: rand() }));

  // Least recently used first (never used comes first), random among ties.
  shuffled.sort((a, b) => {
    const ua = a.p.lastUsedOn ?? "";
    const ub = b.p.lastUsedOn ?? "";
    return ua === ub ? a.r - b.r : ua < ub ? -1 : 1;
  });

  const picks: PoolPlace[] = [];
  const usedSites = new Set<string>();
  for (const { p } of shuffled) {
    if (usedSites.has(p.siteId)) continue;
    picks.push(p);
    usedSites.add(p.siteId);
    if (picks.length === game.roundsPerDay) break;
  }
  if (picks.length < game.roundsPerDay) {
    throw new NotEnoughPlacesError(
      `Need ${game.roundsPerDay} live places on different sites; only ${picks.length} available.`,
    );
  }

  // Easy to hard. Stable sort keeps the least-recently-used order within a difficulty.
  picks.sort((a, b) => a.difficulty - b.difficulty);
  const dayPlaceIds = new Set(picks.map((p) => p.id));

  return picks.map((place, i): GeneratedRound => {
    const mode = game.dailyMix[i];
    if (mode === "pin") return { place_id: place.id, mode };
    return { place_id: place.id, mode, wrong_place_ids: pickWrongAnswers(pool, place, dayPlaceIds, rand) };
  });
}

function pickWrongAnswers(
  pool: readonly PoolPlace[],
  answer: PoolPlace,
  dayPlaceIds: ReadonlySet<string>,
  rand: () => number,
): string[] {
  const candidates = pool
    // Never from the answer's site, and never another round's answer from the same day.
    .filter((p) => p.siteId !== answer.siteId && !dayPlaceIds.has(p.id))
    .map((p) => ({
      p,
      score: (p.category === answer.category ? 2 : 0) + (p.era !== null && p.era === answer.era ? 1 : 0),
      r: rand(),
    }))
    .sort((a, b) => b.score - a.score || a.r - b.r);

  const chosen: PoolPlace[] = [];
  const sites = new Set<string>();
  for (const { p } of candidates) {
    if (sites.has(p.siteId)) continue; // keep the four choices on four different sites
    chosen.push(p);
    sites.add(p.siteId);
    if (chosen.length === game.scheduling.wrongAnswersPerNameRound) break;
  }
  if (chosen.length < game.scheduling.wrongAnswersPerNameRound) {
    throw new NotEnoughPlacesError(`Not enough places on other sites for a name round's wrong answers.`);
  }
  return chosen.map((p) => p.id);
}

/**
 * Generates consecutive days, treating each day's picks as used on that day so
 * later days rotate through the rest of the pool.
 */
export function generateDays(
  pool: readonly PoolPlace[],
  dates: readonly string[],
): { date: string; rounds: GeneratedRound[] }[] {
  const working = pool.map((p) => ({ ...p }));
  const byId = new Map(working.map((p) => [p.id, p]));
  return dates.map((date) => {
    const rounds = generateDay(working, date);
    for (const r of rounds) byId.get(r.place_id)!.lastUsedOn = date;
    return { date, rounds };
  });
}

/** How many days the never-used places would cover at five a day. */
export function daysOfUnusedPlaces(pool: readonly PoolPlace[]): number {
  return Math.floor(pool.filter((p) => p.lastUsedOn === null).length / game.roundsPerDay);
}

/**
 * Fresh wrong answers for one name round (the admin's "re-roll"). Same rules as
 * the generator: other sites only, never another of the day's answers, same
 * category and era preferred, four choices on four different sites.
 */
export function wrongAnswersFor(
  pool: readonly PoolPlace[],
  answerId: string,
  dayPlaceIds: readonly string[],
  seed: string,
  /** The current wrong answers: left out when there are enough others, so a re-roll changes something. */
  avoid: readonly string[] = [],
): string[] {
  const answer = pool.find((p) => p.id === answerId);
  if (!answer) throw new NotEnoughPlacesError("That place isn't live.");
  const day = new Set(dayPlaceIds);
  if (avoid.length) {
    const skip = new Set(avoid);
    try {
      return pickWrongAnswers(
        pool.filter((p) => !skip.has(p.id)),
        answer,
        day,
        seededRandom(seed),
      );
    } catch (err) {
      if (!(err instanceof NotEnoughPlacesError)) throw err;
    }
  }
  return pickWrongAnswers(pool, answer, day, seededRandom(seed));
}
