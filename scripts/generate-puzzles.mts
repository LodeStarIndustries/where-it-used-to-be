// Fills the DEV database with daily puzzles from today (America/Moncton) for the
// next N days, skipping days that already have one. The admin area gets a
// Generate button in Milestone 4; until then this is how dev gets puzzles.
//
//   npm run puzzles:generate          (config's daysAhead, 30)
//   npm run puzzles:generate -- 7     (7 days)
import { createClient } from "@supabase/supabase-js";
import { game } from "@config/game";
import { daysOfUnusedPlaces, generateDays, type PoolPlace } from "@/lib/game/generator";
import { puzzleDateFor, puzzleNumberFor } from "@/lib/puzzle-date";

process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const prodRef = process.env.SUPABASE_PROD_PROJECT_REF;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local");
if (prodRef && url.includes(prodRef)) throw new Error("Refusing: .env.local points at production.");

const db = createClient(url, key, { auth: { persistSession: false } });

const days = Number(process.argv[2] ?? game.scheduling.daysAhead);
if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error("Days must be a whole number from 1 to 366.");

const today = puzzleDateFor();
const dates = Array.from({ length: days }, (_, i) => {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + i);
  return d.toISOString().slice(0, 10);
});

const existing = await db.from("daily_puzzles").select("puzzle_date").in("puzzle_date", dates);
if (existing.error) throw existing.error;
const have = new Set(existing.data.map((r) => r.puzzle_date));
const todo = dates.filter((d) => !have.has(d) && puzzleNumberFor(d) >= 1);

const live = await db
  .from("places")
  .select("id, site_id, category, era, difficulty, last_used_on")
  .eq("status", "live");
if (live.error) throw live.error;
const pool: PoolPlace[] = live.data.map((p) => ({
  id: p.id,
  siteId: p.site_id,
  category: p.category,
  era: p.era,
  difficulty: p.difficulty,
  lastUsedOn: p.last_used_on,
}));

console.log(`Live places: ${pool.length}. Days of never-used places: ${daysOfUnusedPlaces(pool)}.`);
if (todo.length === 0) {
  console.log(`Nothing to do: all ${dates.length} days from ${today} already have puzzles.`);
  process.exit(0);
}

for (const { date, rounds } of generateDays(pool, todo)) {
  const ins = await db.from("daily_puzzles").insert({ puzzle_date: date, number: puzzleNumberFor(date), rounds });
  if (ins.error) throw new Error(`${date}: ${ins.error.message}`);
  const upd = await db
    .from("places")
    .update({ last_used_on: date })
    .in("id", rounds.map((r) => r.place_id));
  if (upd.error) throw new Error(`${date}: ${upd.error.message}`);
  console.log(`#${puzzleNumberFor(date)} ${date}: ${rounds.map((r) => r.mode).join(", ")}`);
}
console.log(`Generated ${todo.length} puzzle(s).`);
