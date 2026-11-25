// The server's game rules, run against an in-memory store.
// The answer-leak tests here are the check for hard rule 2.
import { beforeEach, describe, expect, it } from "vitest";
import type { Category, Era } from "@config/game";
import { generateDay } from "./generator";
import { getToday, streakFrom, submitGuess } from "./service";
import type { GameStore, PlaceWithSite, StoredPlay, StoredPuzzle, StoredRound } from "./store";
import type { NameRound, PinRound } from "./types";

const DEVICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_DEVICE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
// 2026-12-05 at 10:00 in Saint John (AST, UTC-4).
const NOW = new Date("2026-12-05T14:00:00Z");
const TODAY = "2026-12-05";

const eras: (Era | null)[] = ["1970s", "1980s", "1990s", "2000s", "2010s", null];
const cats: Category[] = ["restaurant", "bar", "retail"];

function makePlaces(n: number): PlaceWithSite[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `00000000-0000-4000-9000-${String(i + 1).padStart(12, "0")}`,
    name: `TEST: Place ${i + 1}`,
    category: cats[i % 3],
    era: eras[i % 6],
    yearOpened: 1970 + i,
    yearClosed: 1990 + i,
    fact: `TEST fact ${String(i + 1).padStart(2, "0")}.`,
    sources: [{ label: "TEST", url: "https://example.com/" }],
    site: {
      id: `site-${i + 1}`,
      // Distinctive coordinates so a leak is easy to spot in the JSON.
      lat: 45.25 + i * 0.001234,
      lng: -66.07 + i * 0.001234,
      currentUse: `TEST now ${String(i + 1).padStart(2, "0")}.`,
      addressText: `${String(i + 1).padStart(2, "0")} Example St`,
    },
  }));
}

class MemoryStore implements GameStore {
  puzzles = new Map<string, StoredPuzzle>();
  places: PlaceWithSite[];
  plays = new Map<string, StoredPlay & { deviceId: string; date: string }>();
  devices = new Set<string>();
  events: string[] = [];
  hits = new Map<string, number>();
  constructor(places: PlaceWithSite[]) {
    this.places = places;
  }
  async getPuzzle(date: string) {
    return this.puzzles.get(date) ?? null;
  }
  async getPlaces(ids: string[]) {
    return this.places.filter((p) => ids.includes(p.id));
  }
  async getDevicePlay(deviceId: string, date: string) {
    return [...this.plays.values()].find((p) => p.deviceId === deviceId && p.date === date) ?? null;
  }
  async ensureDevice(deviceId: string) {
    this.devices.add(deviceId);
  }
  async startPlay(deviceId: string, date: string) {
    const existing = await this.getDevicePlay(deviceId, date);
    if (existing) return existing;
    const play = { id: `play-${this.plays.size + 1}`, deviceId, date, totalPoints: 0, completedAt: null, rounds: [] };
    this.plays.set(play.id, play);
    return play;
  }
  async insertRound(playId: string, round: StoredRound) {
    const play = this.plays.get(playId)!;
    if (play.rounds.some((r) => r.roundIndex === round.roundIndex)) return false;
    play.rounds.push(round);
    return true;
  }
  async updatePlay(playId: string, totalPoints: number, completedAt: string | null) {
    const play = this.plays.get(playId)!;
    play.totalPoints = totalPoints;
    play.completedAt = completedAt;
  }
  async completedDates(deviceId: string) {
    return [...this.plays.values()].filter((p) => p.deviceId === deviceId && p.completedAt).map((p) => p.date);
  }
  async rateLimit(key: string, _window: number, max: number) {
    const n = (this.hits.get(key) ?? 0) + 1;
    this.hits.set(key, n);
    return n <= max;
  }
  async logAdminEvent(kind: string) {
    this.events.push(kind);
  }
}

let store: MemoryStore;
let places: PlaceWithSite[];
const placeById = (id: string) => places.find((p) => p.id === id)!;

beforeEach(() => {
  places = makePlaces(20);
  store = new MemoryStore(places);
  const pool = places.map((p, i) => ({
    id: p.id,
    siteId: p.site.id,
    category: p.category,
    era: p.era,
    difficulty: (i % 3) + 1,
    lastUsedOn: null,
  }));
  store.puzzles.set(TODAY, { date: TODAY, number: 11, rounds: generateDay(pool, TODAY) });
});

/** Plays round `i` well: the exact site for pins, the right answer for names. */
async function playRight(i: number, device = DEVICE) {
  const round = store.puzzles.get(TODAY)!.rounds[i];
  const place = placeById(round.place_id);
  return submitGuess(
    store,
    device,
    round.mode === "pin"
      ? { puzzleDate: TODAY, roundIndex: i, lat: place.site.lat, lng: place.site.lng }
      : { puzzleDate: TODAY, roundIndex: i, choiceId: place.id },
    NOW,
  );
}

/** Every value that would give away round `i`'s answer. */
function secretsFor(i: number): string[] {
  const round = store.puzzles.get(TODAY)!.rounds[i];
  const place = placeById(round.place_id);
  // (Years are covered by the "yearClosed" key check; as bare numbers they can match inside coordinates.)
  const secrets = [place.fact!, place.sources[0].url];
  if (round.mode === "pin") {
    // Where it is, and what's there now.
    secrets.push(String(place.site.lat), String(place.site.lng), place.site.currentUse!, place.site.addressText!);
  }
  return secrets;
}

describe("today's puzzle never reveals an answer before its guess (hard rule 2)", () => {
  it("sends only question fields for unplayed rounds", async () => {
    const today = await getToday(store, DEVICE, NOW);
    if (today.status !== "ok") throw new Error("expected a puzzle");
    const json = JSON.stringify(today);

    for (let i = 0; i < 5; i++) for (const s of secretsFor(i)) expect(json).not.toContain(s);
    for (const key of ['"answer"', '"fact"', '"yearClosed"', '"sources"', '"placeId"', '"correct"', '"site_id"']) {
      expect(json).not.toContain(key);
    }

    for (const round of today.rounds) {
      if (round.mode === "pin") {
        expect(Object.keys(round).sort()).toEqual(["category", "era", "index", "mode", "name"]);
      } else {
        expect(Object.keys(round).sort()).toEqual(["choices", "currentUse", "index", "mode", "site"]);
        expect(round.choices).toHaveLength(4);
        for (const c of round.choices) expect(Object.keys(c).sort()).toEqual(["id", "name"]);
      }
    }
    expect(today.results).toEqual([]);
  });

  it("the right choice isn't always in the same position", async () => {
    const positions = new Set<number>();
    for (let d = 1; d <= 20; d++) {
      const date = `2026-12-${String(d).padStart(2, "0")}`;
      const pool = places.map((p, i) => ({ id: p.id, siteId: p.site.id, category: p.category, era: p.era, difficulty: (i % 3) + 1, lastUsedOn: null }));
      store.puzzles.set(date, { date, number: d, rounds: generateDay(pool, date) });
      const today = await getToday(store, null, new Date(`${date}T14:00:00Z`));
      if (today.status !== "ok") throw new Error("expected a puzzle");
      for (const r of today.rounds.filter((r): r is NameRound => r.mode === "name")) {
        const answer = store.puzzles.get(date)!.rounds[r.index].place_id;
        positions.add(r.choices.findIndex((c) => c.id === answer));
      }
    }
    expect(positions.size).toBeGreaterThan(2);
  });

  it("reveals a round's answer only after it's played, and no later round's", async () => {
    const guess = await playRight(0);
    if (guess.status !== "ok") throw new Error(guess.message);
    expect(guess.result.answer.fact).toBe(placeById(store.puzzles.get(TODAY)!.rounds[0].place_id).fact);

    const today = await getToday(store, DEVICE, NOW);
    if (today.status !== "ok") throw new Error("expected a puzzle");
    const json = JSON.stringify({ ...today, results: [] });
    for (let i = 1; i < 5; i++) for (const s of secretsFor(i)) expect(json).not.toContain(s);
    expect(today.results).toHaveLength(1);
    expect(JSON.stringify(today.results)).not.toContain(secretsFor(1)[0]);

    // Another device still sees nothing.
    const other = JSON.stringify(await getToday(store, OTHER_DEVICE, NOW));
    for (const s of secretsFor(0)) expect(other).not.toContain(s);
  });
});

describe("guesses", () => {
  it("plays a full day: a perfect game scores 1,000 and finishes the play", async () => {
    let last;
    for (let i = 0; i < 5; i++) last = await playRight(i);
    if (last?.status !== "ok") throw new Error("expected ok");
    expect(last.totalPoints).toBe(1000);
    expect(last.completed).toBe(true);
    expect(last.streak).toBe(1);
    const today = await getToday(store, DEVICE, NOW);
    expect(today.status === "ok" && today.completed && today.totalPoints === 1000).toBe(true);
  });

  it("scores a pin by distance on the server", async () => {
    const round = store.puzzles.get(TODAY)!.rounds[0];
    const site = placeById(round.place_id).site;
    // About 500 m north.
    const res = await submitGuess(store, DEVICE, { puzzleDate: TODAY, roundIndex: 0, lat: site.lat + 0.0045, lng: site.lng }, NOW);
    if (res.status !== "ok") throw new Error(res.message);
    expect(res.result.distanceM).toBeGreaterThan(490);
    expect(res.result.distanceM).toBeLessThan(510);
    expect(res.result.points).toBeGreaterThanOrEqual(99);
    expect(res.result.points).toBeLessThanOrEqual(101);
  });

  it("scores a wrong name as 0", async () => {
    await playRight(0);
    const round = store.puzzles.get(TODAY)!.rounds[1];
    const res = await submitGuess(store, DEVICE, { puzzleDate: TODAY, roundIndex: 1, choiceId: round.wrong_place_ids![0] }, NOW);
    if (res.status !== "ok") throw new Error(res.message);
    expect(res.result.points).toBe(0);
    expect(res.result.correct).toBe(false);
    expect(res.result.verdict).toBe("who");
  });

  it("rounds are final and played in order", async () => {
    await playRight(0);
    expect((await playRight(0)).status === "error" && (await playRight(0))).toMatchObject({ code: "already_played" });
    const skip = await submitGuess(store, DEVICE, { puzzleDate: TODAY, roundIndex: 3, lat: 45.27, lng: -66.06 }, NOW);
    expect(skip).toMatchObject({ status: "error", code: "out_of_order" });
  });

  it("rejects a choice that isn't one of the four, and a pin outside the map", async () => {
    await playRight(0);
    const bad = await submitGuess(store, DEVICE, { puzzleDate: TODAY, roundIndex: 1, choiceId: places[19].id }, NOW);
    expect(bad).toMatchObject({ status: "error", code: "bad_guess" });
    await playRight(1);
    const far = await submitGuess(store, DEVICE, { puzzleDate: TODAY, roundIndex: 2, lat: 43.65, lng: -79.38 }, NOW);
    expect(far).toMatchObject({ status: "error", code: "bad_guess" });
  });

  it("only accepts today's puzzle, or finishing one started yesterday", async () => {
    const tomorrow = new Date("2026-12-06T14:00:00Z");
    // Never started: refused after midnight.
    expect(await submitGuess(store, OTHER_DEVICE, { puzzleDate: TODAY, roundIndex: 0, lat: 45.27, lng: -66.06 }, tomorrow)).toMatchObject({
      code: "wrong_day",
    });
    // Started before midnight: can finish.
    await playRight(0);
    await playRight(1);
    const round = store.puzzles.get(TODAY)!.rounds[2];
    const site = placeById(round.place_id).site;
    expect(await submitGuess(store, DEVICE, { puzzleDate: TODAY, roundIndex: 2, lat: site.lat, lng: site.lng }, tomorrow)).toMatchObject({
      status: "ok",
    });
    // Future puzzles can't be played early.
    expect(await submitGuess(store, DEVICE, { puzzleDate: "2026-12-07", roundIndex: 0, lat: 45.27, lng: -66.06 }, NOW)).toMatchObject({
      code: "wrong_day",
    });
  });

  it("rate-limits guesses per device", async () => {
    for (let i = 0; i < 30; i++) await submitGuess(store, DEVICE, { puzzleDate: TODAY, roundIndex: 4, lat: 45.27, lng: -66.06 }, NOW);
    expect(await submitGuess(store, DEVICE, { puzzleDate: TODAY, roundIndex: 0, lat: 45.27, lng: -66.06 }, NOW)).toMatchObject({
      code: "rate_limited",
    });
  });

  it("shows a friendly no-puzzle state and logs it for the admin", async () => {
    const today = await getToday(store, DEVICE, new Date("2027-01-10T14:00:00Z"));
    expect(today.status).toBe("none");
    expect(store.events).toContain("no_puzzle");
  });

  it("pin rounds show name, category and era only", async () => {
    const today = await getToday(store, null, NOW);
    if (today.status !== "ok") throw new Error("expected a puzzle");
    const pin = today.rounds[0] as PinRound;
    const place = placeById(store.puzzles.get(TODAY)!.rounds[0].place_id);
    expect(pin).toEqual({ index: 0, mode: "pin", name: place.name, category: place.category, era: place.era });
  });
});

describe("device streak", () => {
  it("counts consecutive days ending today or yesterday", () => {
    expect(streakFrom([], "2026-12-05")).toBe(0);
    expect(streakFrom(["2026-12-05"], "2026-12-05")).toBe(1);
    expect(streakFrom(["2026-12-04", "2026-12-03"], "2026-12-05")).toBe(2);
    expect(streakFrom(["2026-12-03", "2026-12-02"], "2026-12-05")).toBe(0);
    expect(streakFrom(["2026-12-05", "2026-12-04", "2026-12-02"], "2026-12-05")).toBe(2);
    // Across a DST change (2027-03-14).
    expect(streakFrom(["2027-03-15", "2027-03-14", "2027-03-13"], "2027-03-15")).toBe(3);
  });
});
