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

/** Puzzle number for a date: #1 on game.firstPuzzleDate. Zero or less means before launch. */
export function puzzleNumberFor(date: string): number {
  return daysBetween(game.firstPuzzleDate, date) + 1;
}
