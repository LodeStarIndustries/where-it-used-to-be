// What the game service needs from the database. The real implementation is
// supabase-store.ts; tests use an in-memory one, so the service's rules
// (including "no answer before the guess") are tested without a network.
import type { Category, Era, RoundMode } from "@config/game";
import type { GeneratedRound } from "./generator";
import type { Source } from "./types";

export interface StoredPuzzle {
  date: string;
  number: number;
  rounds: GeneratedRound[];
}

export interface PlaceWithSite {
  id: string;
  name: string;
  category: Category;
  era: Era | null;
  yearOpened: number | null;
  yearClosed: number | null;
  fact: string | null;
  sources: Source[];
  site: {
    id: string;
    lat: number;
    lng: number;
    currentUse: string | null;
    addressText: string | null;
  };
}

export interface StoredRound {
  roundIndex: number;
  mode: RoundMode;
  guessLat: number | null;
  guessLng: number | null;
  choicePlaceId: string | null;
  distanceM: number | null;
  points: number;
}

export interface StoredPlay {
  id: string;
  totalPoints: number;
  completedAt: string | null;
  rounds: StoredRound[];
}

/** Whose plays: a signed-in player's account, or a guest's device. */
export type Owner = { userId: string } | { deviceId: string };

export interface GameStore {
  getPuzzle(date: string): Promise<StoredPuzzle | null>;
  getPlaces(ids: string[]): Promise<PlaceWithSite[]>;
  getPlay(owner: Owner, date: string): Promise<StoredPlay | null>;
  /** Creates the device row if it doesn't exist yet. */
  ensureDevice(deviceId: string): Promise<void>;
  /**
   * Creates the play, or returns the existing one for this owner and date. A
   * signed-in player's play also records the device, unless that device already
   * has a play that day.
   */
  startPlay(deviceId: string, userId: string | null, date: string): Promise<StoredPlay>;
  /** False if this round was already stored (rounds are final). */
  insertRound(playId: string, round: StoredRound): Promise<boolean>;
  updatePlay(playId: string, totalPoints: number, completedAt: string | null): Promise<void>;
  /** Dates (YYYY-MM-DD) of finished plays, newest first. */
  completedDates(owner: Owner): Promise<string[]>;
  /** Attaches the device to the account and moves its guest plays (see link_device in SQL). */
  linkDevice(deviceId: string, userId: string): Promise<void>;
  /** Recomputes the account's stored current and best streak. */
  refreshStreaks(userId: string): Promise<void>;
  /** The player's rank on that day's public board, if they finished and have a display name. */
  rankOn(userId: string, date: string): Promise<number | null>;
  /** Counts a hit; false once the limit for the window is reached. */
  rateLimit(key: string, windowSeconds: number, max: number): Promise<boolean>;
  logAdminEvent(kind: string, message: string, details: Record<string, unknown>): Promise<void>;
}
