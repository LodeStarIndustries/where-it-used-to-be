// Scoring and verdicts. Pure functions driven by config/game.ts.
// The server is the only place that calls the scoring functions for a real guess.
import { game, type Verdict } from "@config/game";

/** Points for a pin dropped `distance` metres from the site, rounded to whole points. */
export function pinPoints(distance: number): number {
  if (!Number.isFinite(distance) || distance < 0) return 0;
  for (const band of game.pinScoring) {
    const first = band.fromMeters === game.pinScoring[0].fromMeters;
    const inBand = (first ? distance >= band.fromMeters : distance > band.fromMeters) && distance <= band.toMeters;
    if (inBand) {
      const t = (distance - band.fromMeters) / (band.toMeters - band.fromMeters || 1);
      return Math.round(band.pointsAtStart + (band.pointsAtEnd - band.pointsAtStart) * t);
    }
  }
  return 0;
}

export function namePoints(correct: boolean): number {
  return correct ? game.nameScoring.correct : game.nameScoring.wrong;
}

export function verdictFor(points: number): Verdict {
  return game.verdicts.find((v) => points >= v.minPoints) ?? game.verdicts[game.verdicts.length - 1];
}

/**
 * Share text, for example:
 *   Where It Used To Be #12 · 742/1000
 *   🟩🟨🟧🟩🟥
 *   https://where-it-used-to-be.vercel.app
 */
export function shareText(puzzleNumber: number, roundPoints: readonly number[], url: string): string {
  const total = roundPoints.reduce((a, b) => a + b, 0);
  const max = game.roundsPerDay * game.maxPointsPerRound;
  const squares = roundPoints.map((p) => verdictFor(p).emoji).join("");
  return `Where It Used To Be #${puzzleNumber} · ${total}/${max}\n${squares}\n${url}`;
}

/** Friendly distance: "35 m", "1.2 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}
