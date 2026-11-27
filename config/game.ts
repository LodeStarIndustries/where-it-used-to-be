// Every tunable game value lives here. Values marked (default) are starting points
// Mike can change after playtesting; everything else is a fixed rule of the game.

export type RoundMode = "pin" | "name";
export type Era = "1970s" | "1980s" | "1990s" | "2000s" | "2010s";
export type Category =
  | "restaurant"
  | "bar"
  | "retail"
  | "grocery"
  | "entertainment"
  | "service"
  | "automotive"
  | "other";

export type VerdictKey = "lifer" | "knows" | "closeish" | "away" | "who";

export interface Verdict {
  key: VerdictKey;
  /** Lowest points that earn this verdict (inclusive). */
  minPoints: number;
  label: string;
  /** Used in the share text. */
  emoji: string;
}

/** A straight-line band of the pin scoring curve. */
export interface PinBand {
  /** Band starts here (exclusive, except the first band, which includes 0). */
  fromMeters: number;
  toMeters: number;
  pointsAtStart: number;
  pointsAtEnd: number;
}

export interface GameConfig {
  /** Hard rule 1: the puzzle date is always the calendar date in this zone. */
  timeZone: "America/Moncton";
  /** Puzzle #1 is on this date. No fixed launch date (Mike, 2026-11-25): it counts from the first day of testing. Change it before going public if you want the public to start at #1. */
  firstPuzzleDate: string;
  roundsPerDay: 5;
  maxPointsPerRound: 200;
  /** (default) Round order for each day. Rounds are then sorted easy to hard by difficulty. */
  dailyMix: readonly RoundMode[];
  /** (default) Pin scoring. Beyond the last band scores 0. */
  pinScoring: readonly PinBand[];
  /** (default) Name scoring. */
  nameScoring: { correct: number; wrong: number };
  /** (default) Verdict labels, highest first. Mike will replace the copy. */
  verdicts: readonly Verdict[];
  scheduling: {
    /** (default) How many days ahead the admin generator fills. */
    daysAhead: number;
    /** (default) Wrong answers in name rounds: how many to offer. */
    wrongAnswersPerNameRound: 3;
  };
  /** (default) A new pin within this distance of an existing site is offered as the same site. */
  attachToSiteWithinMeters: number;
  map: {
    /** (default) Starting view: Uptown Saint John. [lng, lat] */
    center: readonly [number, number];
    /** (default) */
    zoom: number;
    minZoom: number;
    maxZoom: number;
    /** (default) Covers the City of Saint John. [[west, south], [east, north]] */
    bounds: readonly [readonly [number, number], readonly [number, number]];
    /** Radius of the circle drawn around the real site on reveal. */
    revealCircleMeters: number;
    styleUrl: string;
    /** Admin-only map with every label (shops, landmarks), for finding where to drop a pin. */
    adminStyleUrl: string;
  };
  limits: {
    displayName: { min: number; max: number };
    groupNameMax: number;
    inviteCodeLength: number;
    factMax: number;
    memoryMax: number;
    photoMaxBytes: number;
    photoTypes: readonly string[];
    /** (default) */
    submissionsPerPlayerPerDay: number;
  };
  /** (default) Rate limits, enforced on the server with a Postgres counter. */
  rateLimits: {
    guessesPerMinutePerDevice: number;
    signInEmailsPerHourPerIp: number;
    signInEmailsPerHourPerAddress: number;
    submissionsPerDayPerPlayer: number;
    groupsCreatedPerDayPerPlayer: number;
    groupJoinsPerHourPerPlayer: number;
  };
  leaderboard: {
    topN: number;
    groupHistoryDays: number;
  };
  /** Hard rule 7: no ads at launch. The layout keeps room for a slot behind this flag. */
  ads: { enabled: boolean };
}

export const game = {
  timeZone: "America/Moncton",
  firstPuzzleDate: "2026-11-25",
  roundsPerDay: 5,
  maxPointsPerRound: 200,
  dailyMix: ["pin", "name", "pin", "name", "pin"],
  pinScoring: [
    { fromMeters: 0, toMeters: 50, pointsAtStart: 200, pointsAtEnd: 200 },
    { fromMeters: 50, toMeters: 500, pointsAtStart: 200, pointsAtEnd: 100 },
    { fromMeters: 500, toMeters: 5000, pointsAtStart: 100, pointsAtEnd: 0 },
  ],
  nameScoring: { correct: 200, wrong: 0 },
  verdicts: [
    { key: "lifer", minPoints: 180, label: "Lifer!", emoji: "🟩" },
    { key: "knows", minPoints: 120, label: "Knows the spot", emoji: "🟨" },
    { key: "closeish", minPoints: 60, label: "Close-ish", emoji: "🟧" },
    { key: "away", minPoints: 1, label: "From away...", emoji: "🟥" },
    { key: "who", minPoints: 0, label: "Who?", emoji: "⬛" },
  ],
  scheduling: {
    daysAhead: 30,
    wrongAnswersPerNameRound: 3,
  },
  attachToSiteWithinMeters: 30,
  map: {
    center: [-66.062, 45.271],
    zoom: 13.5,
    minZoom: 10,
    maxZoom: 18,
    bounds: [
      [-66.23, 45.17],
      [-65.85, 45.37],
    ],
    revealCircleMeters: 50,
    styleUrl: "https://tiles.openfreemap.org/styles/positron",
    adminStyleUrl: "https://tiles.openfreemap.org/styles/liberty",
  },
  limits: {
    displayName: { min: 2, max: 24 },
    groupNameMax: 40,
    inviteCodeLength: 8,
    factMax: 160,
    memoryMax: 500,
    photoMaxBytes: 5 * 1024 * 1024,
    photoTypes: ["image/jpeg", "image/png"],
    submissionsPerPlayerPerDay: 5,
  },
  rateLimits: {
    guessesPerMinutePerDevice: 30,
    signInEmailsPerHourPerIp: 5,
    signInEmailsPerHourPerAddress: 3,
    submissionsPerDayPerPlayer: 5,
    groupsCreatedPerDayPerPlayer: 10,
    groupJoinsPerHourPerPlayer: 20,
  },
  leaderboard: {
    topN: 50,
    groupHistoryDays: 7,
  },
  ads: { enabled: false },
} as const satisfies GameConfig;

export const maxPointsPerDay = game.roundsPerDay * game.maxPointsPerRound;

/** Every place category, in the order forms list them. Matches the place_category enum. */
export const categories: readonly Category[] = [
  "restaurant",
  "bar",
  "retail",
  "grocery",
  "entertainment",
  "service",
  "automotive",
  "other",
];

/** Every era with its own card style. Blank means the fallback card. Matches the era enum. */
export const eras: readonly Era[] = ["1970s", "1980s", "1990s", "2000s", "2010s"];
