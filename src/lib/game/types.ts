// Shapes the browser sees. Nothing in a PlayableRound may reveal its answer
// (hard rule 2); answers arrive only in a RoundResult, after the guess.
import type { Category, Era, RoundMode, VerdictKey } from "@config/game";

export interface PinRound {
  index: number;
  mode: "pin";
  name: string;
  category: Category;
  era: Era | null;
}

export interface NameRound {
  index: number;
  mode: "name";
  /** The site being asked about. Its coordinates are the question, not the answer. */
  site: { lat: number; lng: number };
  currentUse: string | null;
  /** Four choices in a fixed shuffled order: the right place and three wrong ones. */
  choices: { id: string; name: string }[];
}

export type PlayableRound = PinRound | NameRound;

export interface Source {
  label: string;
  url: string;
}

/** Everything the reveal and the era card need, sent only after the round is submitted. */
export interface Answer {
  placeId: string;
  name: string;
  category: Category;
  era: Era | null;
  yearOpened: number | null;
  yearClosed: number | null;
  fact: string | null;
  sources: Source[];
  site: { lat: number; lng: number };
  currentUse: string | null;
  street: string | null;
}

export interface RoundResult {
  index: number;
  mode: RoundMode;
  points: number;
  verdict: VerdictKey;
  /** Pin rounds. */
  guess?: { lat: number; lng: number };
  distanceM?: number;
  /** Name rounds. */
  choiceId?: string;
  correct?: boolean;
  answer: Answer;
}

export type TodayResponse =
  | {
      status: "ok";
      date: string;
      number: number;
      rounds: PlayableRound[];
      /** Rounds this device has already played today, in order. */
      results: RoundResult[];
      totalPoints: number;
      completed: boolean;
      /** Consecutive days with a finished play, ending today or yesterday. */
      streak: number;
      signedIn: boolean;
      /** Rank on today's public board, once a signed-in player has finished. */
      rank: number | null;
    }
  | { status: "none"; date: string; number: number; streak: number; signedIn: boolean };

export interface GuessInput {
  puzzleDate: string;
  roundIndex: number;
  lat?: number;
  lng?: number;
  choiceId?: string;
}

export type GuessResponse =
  | { status: "ok"; result: RoundResult; totalPoints: number; completed: boolean; streak: number; rank: number | null }
  | { status: "error"; code: GuessErrorCode; message: string };

export type GuessErrorCode =
  | "no_puzzle"
  | "wrong_day"
  | "out_of_order"
  | "already_played"
  | "bad_guess"
  | "rate_limited";
