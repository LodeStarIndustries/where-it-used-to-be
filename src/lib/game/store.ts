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

export interface GameStore {
  getPuzzle(date: string): Promise<StoredPuzzle | null>;
  getPlaces(ids: string[]): Promise<PlaceWithSite[]>;
  getDevicePlay(deviceId: string, date: string): Promise<StoredPlay | null>;
  /** Creates the device row if it doesn't exist yet. */
  ensureDevice(deviceId: string): Promise<void>;
  /** Creates the play, or returns the existing one for this device and date. */
  startPlay(deviceId: string, date: string): Promise<StoredPlay>;
  /** False if this round was already stored (rounds are final). */
  insertRound(playId: string, round: StoredRound): Promise<boolean>;
  updatePlay(playId: string, totalPoints: number, completedAt: string | null): Promise<void>;
  /** Dates (YYYY-MM-DD) of this device's finished plays, newest first. */
  completedDates(deviceId: string): Promise<string[]>;
  /** Counts a hit; false once the limit for the window is reached. */
  rateLimit(key: string, windowSeconds: number, max: number): Promise<boolean>;
  logAdminEvent(kind: string, message: string, details: Record<string, unknown>): Promise<void>;
}
