import { describe, expect, it } from "vitest";
import type { Category, Era } from "@config/game";
import { daysOfUnusedPlaces, generateDay, generateDays, NotEnoughPlacesError, type PoolPlace } from "./generator";

const cats: Category[] = ["restaurant", "bar", "retail", "grocery"];
const eras: (Era | null)[] = ["1970s", "1980s", "1990s", null];

/** n places, one per site, unless sharedSites says otherwise. */
function makePool(n: number, sharedSites: Record<number, number> = {}): PoolPlace[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    siteId: `s${sharedSites[i] ?? i}`,
    category: cats[i % cats.length],
    era: eras[i % eras.length],
    difficulty: (i % 3) + 1,
    lastUsedOn: null,
  }));
}

describe("puzzle generator", () => {
  it("makes five rounds in the daily mix, easy to hard", () => {
    const pool = makePool(30);
    const rounds = generateDay(pool, "2026-12-01");
    expect(rounds.map((r) => r.mode)).toEqual(["pin", "name", "pin", "name", "pin"]);
    const diffs = rounds.map((r) => pool.find((p) => p.id === r.place_id)!.difficulty);
    expect(diffs).toEqual([...diffs].sort((a, b) => a - b));
  });

  it("never puts two rounds on the same site", () => {
    // Places 0-9 all share site s0.
    const pool = makePool(20, Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, 0])));
    for (let d = 1; d <= 20; d++) {
      const rounds = generateDay(pool, `2026-12-${String(d).padStart(2, "0")}`);
      const sites = rounds.map((r) => pool.find((p) => p.id === r.place_id)!.siteId);
      expect(new Set(sites).size).toBe(5);
    }
  });

  it("gives name rounds three wrong answers from other sites, none of them another round's answer", () => {
    const pool = makePool(30, { 1: 0, 2: 0 });
    const rounds = generateDay(pool, "2026-12-02");
    const answers = new Set(rounds.map((r) => r.place_id));
    for (const r of rounds.filter((r) => r.mode === "name")) {
      const site = pool.find((p) => p.id === r.place_id)!.siteId;
      expect(r.wrong_place_ids).toHaveLength(3);
      const wrongSites = r.wrong_place_ids!.map((id) => pool.find((p) => p.id === id)!.siteId);
      expect(wrongSites).not.toContain(site);
      expect(new Set(wrongSites).size).toBe(3);
      for (const id of r.wrong_place_ids!) expect(answers.has(id)).toBe(false);
    }
    for (const r of rounds.filter((r) => r.mode === "pin")) expect(r.wrong_place_ids).toBeUndefined();
  });

  it("prefers wrong answers from the same category and era", () => {
    const pool = makePool(40);
    const rounds = generateDay(pool, "2026-12-03");
    for (const r of rounds.filter((r) => r.mode === "name")) {
      const answer = pool.find((p) => p.id === r.place_id)!;
      for (const id of r.wrong_place_ids!) expect(pool.find((p) => p.id === id)!.category).toBe(answer.category);
    }
  });

  it("uses least recently used places first, so none repeat until the pool is used up", () => {
    const pool = makePool(25);
    const days = generateDays(pool, ["2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05"]);
    const used = days.flatMap((d) => d.rounds.map((r) => r.place_id));
    expect(new Set(used).size).toBe(25);
    // The sixth day starts reusing the oldest.
    const more = generateDays(pool, ["2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06"]);
    const day1 = new Set(more[0].rounds.map((r) => r.place_id));
    for (const r of more[5].rounds) expect(day1.has(r.place_id)).toBe(true);
  });

  it("prefers places that were never used over recently used ones", () => {
    const pool = makePool(10).map((p, i) => ({ ...p, lastUsedOn: i < 5 ? "2026-11-30" : null }));
    const picked = generateDay(pool, "2026-12-01").map((r) => r.place_id);
    for (const id of picked) expect(Number(id.slice(1))).toBeGreaterThanOrEqual(5);
  });

  it("is the same for the same pool and date", () => {
    const pool = makePool(30);
    expect(generateDay(pool, "2026-12-09")).toEqual(generateDay(pool, "2026-12-09"));
  });

  it("refuses when there aren't five sites", () => {
    expect(() => generateDay(makePool(4), "2026-12-01")).toThrow(NotEnoughPlacesError);
  });

  it("counts days of never-used places", () => {
    expect(daysOfUnusedPlaces(makePool(23))).toBe(4);
  });
});

describe("re-rolling a name round's wrong answers", () => {
  it("follows the same rules and changes with the seed", async () => {
    const { wrongAnswersFor } = await import("./generator");
    const pool = Array.from({ length: 30 }, (_, i) => ({
      id: `p${i}`,
      siteId: `s${i % 25}`,
      category: (["restaurant", "bar", "retail"] as const)[i % 3],
      era: null,
      difficulty: 1,
      lastUsedOn: null,
    }));
    const day = ["p0", "p1", "p2", "p3", "p4"];
    const a = wrongAnswersFor(pool, "p0", day, "one");
    const b = wrongAnswersFor(pool, "p0", day, "two");
    for (const set of [a, b]) {
      expect(set).toHaveLength(3);
      expect(set.some((id) => day.includes(id))).toBe(false);
      const sites = set.map((id) => pool.find((p) => p.id === id)!.siteId);
      expect(new Set([...sites, "s0"]).size).toBe(4);
    }
    expect(a).not.toEqual(b);
    // Asking to avoid the current answers gives three different ones.
    const c = wrongAnswersFor(pool, "p0", day, "one", a);
    expect(c.some((id) => a.includes(id))).toBe(false);
  });
});
