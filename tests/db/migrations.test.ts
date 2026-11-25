// Runs every migration on a fresh in-memory Postgres (PGlite) with small Supabase
// stand-ins, then checks the security and data rules the schema promises.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..");
const migrationsDir = join(root, "supabase", "migrations");
const read = (p: string) => readFileSync(p, "utf8");

const PLAYER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ADMIN = "33333333-3333-4333-8333-333333333333";
const place = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, "0")}`;

async function freshDb() {
  const db = new PGlite();
  await db.exec(read(join(__dirname, "supabase-stubs.sql")));
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(read(join(migrationsDir, file)));
  }
  return db;
}

async function asRole(db: PGlite, role: "anon" | "authenticated", userId: string | null, sql: string) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${userId ?? ""}', false);`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

const fixtures = read(join(root, "supabase", "fixtures", "dev_fixtures.sql"));

function puzzle(date: string, number: number, rounds: object[]) {
  return `insert into public.daily_puzzles (puzzle_date, number, rounds)
          values ('${date}', ${number}, '${JSON.stringify(rounds)}'::jsonb)`;
}
const validRounds = [
  { place_id: place(1), mode: "pin" },
  { place_id: place(3), mode: "name", wrong_place_ids: [place(7), place(9), place(11)] },
  { place_id: place(4), mode: "pin" },
  { place_id: place(5), mode: "name", wrong_place_ids: [place(13), place(14), place(15)] },
  { place_id: place(6), mode: "pin" },
];

describe("migrations on a fresh database", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await freshDb();
    await db.exec(`
      insert into auth.users (id) values ('${PLAYER}'), ('${OTHER}'), ('${ADMIN}');
      update public.profiles set is_admin = true where id = '${ADMIN}';
    `);
  });

  it("creates a profile for every new auth user", async () => {
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.profiles");
    expect(rows[0].n).toBe(3);
  });

  it("creates the private photos bucket", async () => {
    const { rows } = await db.query<{ public: boolean }>("select public from storage.buckets where id = 'photos'");
    expect(rows).toEqual([{ public: false }]);
  });

  it("computes today's date in America/Moncton", async () => {
    const { rows } = await db.query<{ ok: boolean }>(
      "select public.moncton_today() = (now() at time zone 'America/Moncton')::date as ok",
    );
    expect(rows[0].ok).toBe(true);
  });

  describe("TEST: fixtures (hard rule 8)", () => {
    it("refuse to load while the environment is unset", async () => {
      await expect(db.exec(fixtures)).rejects.toThrow(/Refusing to load TEST: fixtures/);
    });

    it("load in a development database, and can run twice", async () => {
      await db.exec("update public.app_settings set environment = 'development'");
      await db.exec(fixtures);
      await db.exec(fixtures);
      const { rows } = await db.query<{ live: number; draft: number }>(`
        select count(*) filter (where status = 'live')::int as live,
               count(*) filter (where status = 'draft')::int as draft
        from public.places`);
      expect(rows[0]).toEqual({ live: 25, draft: 1 });
    });

    it("are rejected by the database itself outside development", async () => {
      await db.exec("update public.app_settings set environment = 'production'");
      await expect(
        db.exec(`insert into public.places (site_id, name, category)
                 values ('00000000-0000-4000-8000-000000000001', 'TEST: Sneaky', 'other')`),
      ).rejects.toThrow(/only allowed in a development database/);
      await db.exec("update public.app_settings set environment = 'development'");
    });
  });

  describe("row level security", () => {
    it.each(["sites", "places", "daily_puzzles", "devices", "app_settings", "rate_limit_hits"])(
      "anon cannot read %s",
      async (table) => {
        await expect(asRole(db, "anon", null, `select * from public.${table}`)).rejects.toThrow(/permission denied/);
      },
    );

    it.each(["sites", "places", "daily_puzzles"])("a signed-in player sees no rows in %s", async (table) => {
      const { rows } = await asRole(db, "authenticated", PLAYER, `select * from public.${table}`);
      expect(rows).toHaveLength(0);
    });

    it("an admin can read places", async () => {
      const { rows } = await asRole(db, "authenticated", ADMIN, "select id from public.places");
      expect(rows.length).toBeGreaterThan(20);
    });

    it("a player reads only their own profile", async () => {
      const { rows } = await asRole(db, "authenticated", PLAYER, "select id from public.profiles");
      expect(rows).toEqual([{ id: PLAYER }]);
    });

    it("a player can set their display name but not make themselves admin", async () => {
      await asRole(db, "authenticated", PLAYER, "update public.profiles set display_name = 'Pat' where id = auth.uid()");
      await expect(
        asRole(db, "authenticated", PLAYER, "update public.profiles set is_admin = true where id = auth.uid()"),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asRole(db, "authenticated", PLAYER, "update public.profiles set best_streak = 999 where id = auth.uid()"),
      ).rejects.toThrow(/permission denied/);
    });

    it("the server (service_role) can read every table and call server functions", async () => {
      await db.exec("set role service_role");
      try {
        const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.places");
        expect(rows[0].n).toBeGreaterThan(20);
        await db.query("select environment from public.app_settings");
        await db.query("select * from public.devices, public.rate_limit_hits, public.admin_events limit 1");
        const hit = await db.query<{ ok: boolean }>("select public.rate_limit_hit('test', 60, 5) as ok");
        expect(hit.rows[0].ok).toBe(true);
      } finally {
        await db.exec("reset role");
      }
    });

    it("no SECURITY DEFINER function is exposed in the public schema except trigger and server-only ones", async () => {
      const { rows } = await db.query<{ name: string }>(`
        select p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef
          and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
          and p.prorettype <> 'trigger'::regtype`);
      expect(rows).toEqual([]);
    });

    it("an admin's own session can add a place through RLS (helpers work for authenticated)", async () => {
      await asRole(
        db,
        "authenticated",
        ADMIN,
        `insert into public.places (site_id, name, category)
         values ('00000000-0000-4000-8000-000000000001', 'TEST: Added by admin', 'other')`,
      );
      await expect(
        asRole(
          db,
          "authenticated",
          OTHER,
          `insert into public.places (site_id, name, category)
           values ('00000000-0000-4000-8000-000000000001', 'TEST: Added by player', 'other')`,
        ),
      ).rejects.toThrow(/row-level security/);
    });

    it("server-only functions are not callable by players", async () => {
      await expect(
        asRole(db, "authenticated", PLAYER, "select public.rate_limit_hit('x', 60, 5)"),
      ).rejects.toThrow(/permission denied/);
    });
  });

  describe("accounts", () => {
    it("display names are unique, ignoring case and spaces", async () => {
      // PLAYER is already "Pat" (set in the RLS tests above).
      await expect(
        db.exec(`update public.profiles set display_name = ' pAT ' where id = '${OTHER}'`),
      ).rejects.toThrow(/profiles_display_name_unique/);
      await db.exec(`update public.profiles set display_name = 'Pat 2' where id = '${OTHER}'`);
      // Any number of players can still have no name yet.
      const { rows } = await db.query<{ n: number }>(
        "select count(*)::int as n from public.profiles where display_name is null",
      );
      expect(rows[0].n).toBeGreaterThan(0);
    });

    it("deleting a group owner's account deletes their group and its memberships", async () => {
      const owner = "66666666-6666-4666-8666-666666666666";
      await db.exec(`
        insert into auth.users (id) values ('${owner}');
        insert into public.groups (id, name, invite_code, owner_id)
          values ('77777777-7777-4777-8777-777777777777', 'TEST group', 'ABCD1234', '${owner}');
        insert into public.group_members (group_id, user_id) values
          ('77777777-7777-4777-8777-777777777777', '${owner}'),
          ('77777777-7777-4777-8777-777777777777', '${ADMIN}');
        delete from auth.users where id = '${owner}';`);
      const { rows } = await db.query<{ g: number; m: number }>(`
        select (select count(*) from public.groups where id = '77777777-7777-4777-8777-777777777777')::int as g,
               (select count(*) from public.group_members where group_id = '77777777-7777-4777-8777-777777777777')::int as m`);
      expect(rows[0]).toEqual({ g: 0, m: 0 });
    });
  });

  describe("place and puzzle rules", () => {
    it("a place on a site without coordinates cannot go live", async () => {
      await expect(
        db.exec(`update public.places set status = 'live', verified_at = now() where id = '${place(99)}'`),
      ).rejects.toThrow(/has no coordinates/);
    });

    it("a place cannot go live without a verified date", async () => {
      await expect(
        db.exec(`insert into public.places (site_id, name, category, difficulty, status)
                 values ('00000000-0000-4000-8000-000000000001', 'TEST: Unverified', 'bar', 1, 'live')`),
      ).rejects.toThrow(/places_live_needs_verified_and_difficulty/);
    });

    it("accepts a valid five-round puzzle", async () => {
      await db.exec(puzzle("2099-01-01", 1, validRounds));
    });

    it("rejects two rounds on the same site", async () => {
      const rounds = structuredClone(validRounds);
      rounds[4] = { place_id: place(23), mode: "pin" }; // shares a site with place 1
      await expect(db.exec(puzzle("2099-01-02", 2, rounds))).rejects.toThrow(/shares a site/);
    });

    it("rejects a wrong answer from the same site as the right answer", async () => {
      const rounds = structuredClone(validRounds);
      rounds[1] = { place_id: place(2), mode: "name", wrong_place_ids: [place(24), place(9), place(11)] };
      await expect(db.exec(puzzle("2099-01-03", 3, rounds))).rejects.toThrow(/from other sites/);
    });

    it("rejects a draft place in a round", async () => {
      const rounds = structuredClone(validRounds);
      rounds[0] = { place_id: place(99), mode: "pin" };
      await expect(db.exec(puzzle("2099-01-04", 4, rounds))).rejects.toThrow(/not live/);
    });

    it("rejects changes to a puzzle whose date has started", async () => {
      await db.exec(puzzle("2000-01-01", 500, validRounds));
      const swapped = structuredClone(validRounds);
      swapped[0] = { place_id: place(8), mode: "pin" };
      await expect(
        db.exec(`update public.daily_puzzles set rounds = '${JSON.stringify(swapped)}'::jsonb where puzzle_date = '2000-01-01'`),
      ).rejects.toThrow(/has started or is locked/);
    });
  });

  describe("plays", () => {
    it("allows one play per user per date, and rounds are final", async () => {
      await db.exec(`insert into public.plays (id, puzzle_date, user_id)
                     values ('44444444-4444-4444-8444-444444444444', '2099-01-01', '${PLAYER}')`);
      await expect(
        db.exec(`insert into public.plays (puzzle_date, user_id) values ('2099-01-01', '${PLAYER}')`),
      ).rejects.toThrow(/plays_one_per_user_per_date/);

      await db.exec(`insert into public.play_rounds (play_id, round_index, mode, guess_lat, guess_lng, distance_m, points)
                     values ('44444444-4444-4444-8444-444444444444', 0, 'pin', 45.27, -66.06, 120, 184)`);
      await expect(
        db.exec(`update public.play_rounds set points = 200 where play_id = '44444444-4444-4444-8444-444444444444'`),
      ).rejects.toThrow(/Rounds are final/);
    });

    it("allows one play per device per date", async () => {
      await db.exec(`insert into public.devices (id) values ('55555555-5555-4555-8555-555555555555')`);
      await db.exec(`insert into public.plays (puzzle_date, device_id) values ('2099-01-01', '55555555-5555-4555-8555-555555555555')`);
      await expect(
        db.exec(`insert into public.plays (puzzle_date, device_id) values ('2099-01-01', '55555555-5555-4555-8555-555555555555')`),
      ).rejects.toThrow(/plays_one_per_device_per_date/);
    });

    it("a player reads only their own plays", async () => {
      const mine = await asRole(db, "authenticated", PLAYER, "select id from public.plays");
      const theirs = await asRole(db, "authenticated", OTHER, "select id from public.plays");
      expect(mine.rows).toHaveLength(1);
      expect(theirs.rows).toHaveLength(0);
    });

    it("deleting an account removes the profile and its plays", async () => {
      await db.exec(`delete from auth.users where id = '${PLAYER}'`);
      const { rows } = await db.query<{ p: number; pl: number }>(`
        select (select count(*) from public.profiles where id = '${PLAYER}')::int as p,
               (select count(*) from public.plays where user_id = '${PLAYER}')::int as pl`);
      expect(rows[0]).toEqual({ p: 0, pl: 0 });
    });
  });
});
