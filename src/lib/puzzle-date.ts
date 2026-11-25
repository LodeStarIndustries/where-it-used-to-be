import { game } from "@config/game";

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: game.timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * The puzzle date (YYYY-MM-DD) for a moment in time, always in America/Moncton
 * (hard rule 1). Never uses the server's or browser's own time zone.
 */
export function puzzleDateFor(at: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return formatter.format(at);
}

/** Whole days from `from` to `to`, both YYYY-MM-DD calendar dates. */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/** The calendar date `n` days after `date` (YYYY-MM-DD). */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The moment the next puzzle starts: midnight in America/Moncton. Atlantic Time is
 * UTC-4 or UTC-3, so it's 03:00 or 04:00 UTC on the next date; pick whichever
 * is the real rollover.
 */
export function nextPuzzleAt(now: Date = new Date()): Date {
  const tomorrow = addDays(puzzleDateFor(now), 1);
  for (const hoursUtc of [3, 4]) {
    const at = new Date(`${tomorrow}T0${hoursUtc}:00:00Z`);
    if (puzzleDateFor(at) === tomorrow && puzzleDateFor(new Date(at.getTime() - 1)) !== tomorrow) return at;
  }
  return new Date(`${tomorrow}T04:00:00Z`);
}

/** Puzzle number for a date: #1 on game.firstPuzzleDate. Zero or less means before launch. */
export function puzzleNumberFor(date: string): number {
  return daysBetween(game.firstPuzzleDate, date) + 1;
}
