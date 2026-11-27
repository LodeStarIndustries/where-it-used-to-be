// Milestone 3 database functions: linking guest plays, streaks and leaderboards.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(p, "utf8");
const place = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, "0")}`;

const ANA = "a0000000-0000-4000-8000-000000000001";
const BEN = "b0000000-0000-4000-8000-000000000002";
const CAL = "c0000000-0000-4000-8000-000000000003";
const NONAME = "d0000000-0000-4000-8000-000000000004";
const DEVICE = "e0000000-0000-4000-8000-000000000005";
const GROUP = "f0000000-0000-4000-8000-000000000006";

const rounds = JSON.stringify([
  { place_id: place(1), mode: "pin" },
  { place_id: place(3), mode: "name", wrong_place_ids: [place(7), place(9), place(11)] },
  { place_id: place(4), mode: "pin" },
  { place_id: place(5), mode: "name", wrong_place_ids: [place(13), place(14), place(15)] },
  { place_id: place(6), mode: "pin" },
]);

/** A date relative to today in New Brunswick, as SQL. */
const day = (offset: number) => `(public.moncton_today() + ${offset})`;

describe("accounts and social functions", () => {
  let db: PGlite;

  async function play(opts: { user?: string; device?: string; offset: number; total: number; finishedMinute?: number }) {
    const completed = opts.finishedMinute === undefined ? "now()" : `'2026-01-01T00:${String(opts.finishedMinute).padStart(2, "0")}:00Z'`;
    await db.exec(`insert into public.plays (puzzle_date, user_id, device_id, total_points, completed_at)
                   values (${day(opts.offset)}, ${opts.user ? `'${opts.user}'` : "null"},
                           ${opts.device ? `'${opts.device}'` : "null"}, ${opts.total}, ${completed})`);
  }

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(read(join(__dirname, "supabase-stubs.sql")));
    const dir = join(root, "supabase", "migrations");
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) await db.exec(read(join(dir, f)));
    await db.exec("update public.app_settings set environment = 'development'");
    await db.exec(read(join(root, "supabase", "fixtures", "dev_fixtures.sql")));
    for (let i = -10; i <= 0; i++) {
      await db.exec(`insert into public.daily_puzzles (puzzle_date, number, rounds)
                     values (${day(i)}, ${100 + i}, '${rounds}'::jsonb)`);
    }
    await db.exec(`
      insert into auth.users (id) values ('${ANA}'), ('${BEN}'), ('${CAL}'), ('${NONAME}');
      update public.profiles set display_name = 'Ana' where id = '${ANA}';
      update public.profiles set display_name = 'Ben' where id = '${BEN}';
      update public.profiles set display_name = 'Cal' where id = '${CAL}';
      insert into public.devices (id) values ('${DEVICE}');
    `);
  });

  it("new profiles are not opted in to marketing", async () => {
    const { rows } = await db.query(`select marketing_opt_in, marketing_opt_in_at from public.profiles where id = '${ANA}'`);
    expect(rows[0]).toEqual({ marketing_opt_in: false, marketing_opt_in_at: null });
  });

  it("linking a device moves its guest plays, but keeps the account's play on a shared date", async () => {
    await play({ device: DEVICE, offset: -2, total: 300 });
    await play({ device: DEVICE, offset: -1, total: 400 });
    await play({ user: ANA, offset: -1, total: 900 });

    const moved = await db.query<{ n: number }>(`select public.link_device('${DEVICE}', '${ANA}') as n`);
    expect(moved.rows[0].n).toBe(1);

    const { rows } = await db.query<{ total_points: number; user_id: string | null }>(
      `select total_points, user_id from public.plays where device_id = '${DEVICE}' or user_id = '${ANA}' order by puzzle_date, total_points`,
    );
    expect(rows).toEqual([
      { total_points: 300, user_id: ANA },
      { total_points: 400, user_id: null },
      { total_points: 900, user_id: ANA },
    ]);
    const device = await db.query<{ user_id: string }>(`select user_id from public.devices where id = '${DEVICE}'`);
    expect(device.rows[0].user_id).toBe(ANA);
  });

  it("linking creates the device row if the device never played", async () => {
    const fresh = "e0000000-0000-4000-8000-000000000099";
    await db.query(`select public.link_device('${fresh}', '${BEN}')`);
    const { rows } = await db.query(`select user_id from public.devices where id = '${fresh}'`);
    expect(rows).toEqual([{ user_id: BEN }]);
  });

  it("streaks count consecutive finished days ending today or yesterday, and best never drops", async () => {
    // Ana finished -2 and -1 (linked above): current 2.
    let { rows } = await db.query<{ current_streak: number; best_streak: number }>(
      `select * from public.refresh_streaks('${ANA}')`,
    );
    expect(rows[0]).toEqual({ current_streak: 2, best_streak: 2 });

    // Ben: -9, -8, -7 then a gap, then -3: current 0, best 3.
    for (const offset of [-9, -8, -7, -3]) await play({ user: BEN, offset, total: 100 });
    ({ rows } = await db.query<{ current_streak: number; best_streak: number }>(`select * from public.refresh_streaks('${BEN}')`));
    expect(rows[0]).toEqual({ current_streak: 0, best_streak: 3 });

    await db.exec(`delete from public.plays where user_id = '${BEN}' and puzzle_date = ${day(-8)}`);
    ({ rows } = await db.query<{ current_streak: number; best_streak: number }>(`select * from public.refresh_streaks('${BEN}')`));
    expect(rows[0]).toEqual({ current_streak: 0, best_streak: 3 });
  });

  it("today's board ranks by points, then earlier finish, and leaves out guests and unnamed players", async () => {
    await play({ user: ANA, offset: 0, total: 700, finishedMinute: 30 });
    await play({ user: BEN, offset: 0, total: 700, finishedMinute: 10 });
    await play({ user: CAL, offset: 0, total: 950, finishedMinute: 50 });
    await play({ user: NONAME, offset: 0, total: 1000 });
    await play({ device: DEVICE, offset: 0, total: 1000 });

    const { rows } = await db.query<{ rank: number; display_name: string; is_me: boolean }>(
      `select rank::int, display_name, is_me from public.leaderboard_day(${day(0)}, '${ANA}')`,
    );
    expect(rows).toEqual([
      { rank: 1, display_name: "Cal", is_me: false },
      { rank: 2, display_name: "Ben", is_me: false },
      { rank: 3, display_name: "Ana", is_me: true },
    ]);
  });

  it("the board returns the top rows plus the viewer's own row", async () => {
    const { rows } = await db.query<{ rank: number; display_name: string }>(
      `select rank::int, display_name from public.leaderboard_day(${day(0)}, '${ANA}', null, 1)`,
    );
    expect(rows).toEqual([
      { rank: 1, display_name: "Cal" },
      { rank: 3, display_name: "Ana" },
    ]);
  });

  it("group boards include members only, for today and the last 7 days", async () => {
    await db.exec(`
      insert into public.groups (id, name, invite_code, owner_id) values ('${GROUP}', 'TEST: Crew', 'AbCd1234', '${ANA}');
      insert into public.group_members (group_id, user_id) values ('${GROUP}', '${ANA}'), ('${GROUP}', '${BEN}');
    `);
    const today = await db.query<{ rank: number; display_name: string }>(
      `select rank::int, display_name from public.leaderboard_day(${day(0)}, '${ANA}', '${GROUP}')`,
    );
    expect(today.rows).toEqual([
      { rank: 1, display_name: "Ben" },
      { rank: 2, display_name: "Ana" },
    ]);

    // Week (-6 to today): Ana 300 + 900 + 700 = 1900 over 3 days; Ben 100 (-3) + 700 = 800 (-7 is outside).
    const week = await db.query<{ display_name: string; total_points: number; days_played: number }>(
      `select display_name, total_points::int, days_played from public.leaderboard_group_week('${GROUP}', ${day(0)}, '${ANA}')`,
    );
    expect(week.rows).toEqual([
      { display_name: "Ana", total_points: 1900, days_played: 3 },
      { display_name: "Ben", total_points: 800, days_played: 2 },
    ]);
  });

  it("players can't call the server-only functions", async () => {
    for (const sql of [
      `select public.link_device('${DEVICE}', '${ANA}')`,
      `select * from public.refresh_streaks('${ANA}')`,
      `select * from public.leaderboard_day(current_date, '${ANA}')`,
      `select * from public.leaderboard_group_week('${GROUP}', current_date, '${ANA}')`,
    ]) {
      await db.exec(`set role authenticated`);
      try {
        await expect(db.query(sql)).rejects.toThrow(/permission denied/);
      } finally {
        await db.exec("reset role");
      }
    }
  });
});
