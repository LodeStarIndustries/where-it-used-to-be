// Milestone 4 database functions: scheduling guards, last-used and nearby sites.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(p, "utf8");
const place = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, "0")}`;
const site = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const rounds = (first: number) =>
  JSON.stringify([
    { place_id: place(first), mode: "pin" },
    { place_id: place(3), mode: "name", wrong_place_ids: [place(7), place(9), place(11)] },
    { place_id: place(4), mode: "pin" },
    { place_id: place(5), mode: "name", wrong_place_ids: [place(13), place(14), place(15)] },
    { place_id: place(6), mode: "pin" },
  ]);
const day = (offset: number) => `(public.moncton_today() + ${offset})`;

describe("admin functions", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(read(join(__dirname, "supabase-stubs.sql")));
    const dir = join(root, "supabase", "migrations");
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) await db.exec(read(join(dir, f)));
    await db.exec("update public.app_settings set environment = 'development'");
    await db.exec(read(join(root, "supabase", "fixtures", "dev_fixtures.sql")));
    await db.exec(`
      insert into public.daily_puzzles (puzzle_date, number, rounds) values
        (${day(-3)}, 97, '${rounds(1)}'::jsonb),
        (${day(2)}, 102, '${rounds(2)}'::jsonb);
    `);
  });

  it("keeps a place live while today's or a future puzzle uses it", async () => {
    // place 2 is an answer on day +2; place 11 is a wrong answer there.
    for (const id of [place(2), place(11)]) {
      await expect(db.exec(`update public.places set status = 'retired' where id = '${id}'`)).rejects.toThrow(
        /must stay live/,
      );
    }
    // place 1 was only used three days ago, so it can be retired.
    await db.exec(`update public.places set status = 'retired' where id = '${place(1)}'`);
    await db.exec(`update public.places set status = 'live' where id = '${place(1)}'`);
  });

  it("recomputes last_used_on from the puzzles' answers", async () => {
    await db.exec(`update public.places set last_used_on = '2000-01-01'`);
    await db.query("select public.refresh_last_used()");
    const { rows } = await db.query<{ id: string; last: string | null }>(
      `select id, to_char(last_used_on, 'YYYY-MM-DD') as last from public.places where id in ('${place(1)}', '${place(2)}', '${place(3)}', '${place(7)}', '${place(20)}') order by id`,
    );
    const today = (await db.query<{ t: string }>("select to_char(public.moncton_today(), 'YYYY-MM-DD') as t")).rows[0].t;
    const plus = (n: number) => {
      const d = new Date(`${today}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().slice(0, 10);
    };
    expect(Object.fromEntries(rows.map((r) => [r.id, r.last]))).toEqual({
      [place(1)]: plus(-3),
      [place(2)]: plus(2),
      [place(3)]: plus(2),
      // Wrong answers and unused places don't count as used.
      [place(7)]: null,
      [place(20)]: null,
    });
  });

  it("finds sites within a distance, nearest first, with their places", async () => {
    const { rows: s } = await db.query<{ lat: number; lng: number }>(`select lat, lng from public.sites where id = '${site(1)}'`);
    // About 20 m north of site 1.
    const { rows } = await db.query<{ site_id: string; distance_m: number; place_names: string[] }>(
      `select * from public.sites_near(${s[0].lat + 0.00018}, ${s[0].lng}, 30)`,
    );
    expect(rows[0].site_id).toBe(site(1));
    expect(rows[0].distance_m).toBeGreaterThan(15);
    expect(rows[0].distance_m).toBeLessThan(25);
    expect(rows[0].place_names.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.distance_m <= 30)).toBe(true);
  });

  it("players can't call the admin functions", async () => {
    for (const sql of ["select public.refresh_last_used()", "select * from public.sites_near(45.27, -66.06, 30)"]) {
      await db.exec("set role authenticated");
      try {
        await expect(db.query(sql)).rejects.toThrow(/permission denied/);
      } finally {
        await db.exec("reset role");
      }
    }
  });
});
