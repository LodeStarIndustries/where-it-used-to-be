"use client";
// Browser side: the guest's device ID and calls to the game API.
import type { GuessInput, GuessResponse, TodayResponse } from "./types";

const KEY = "wiutb.deviceId";
let memoryId: string | null = null;

/** A random UUID kept in local storage, so a guest's plays are scored and stored on the server. */
export function deviceId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    // Private mode or blocked storage: still playable for this visit.
    memoryId ??= crypto.randomUUID();
    return memoryId;
  }
}

const headers = () => ({ "x-device-id": deviceId(), "Content-Type": "application/json" });

export async function fetchToday(): Promise<TodayResponse> {
  const res = await fetch("/api/puzzle", { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`Couldn't load today's puzzle (${res.status})`);
  return res.json();
}

export async function sendGuess(input: GuessInput): Promise<GuessResponse> {
  const res = await fetch("/api/guess", { method: "POST", headers: headers(), body: JSON.stringify(input) });
  const body = (await res.json().catch(() => null)) as GuessResponse | null;
  if (body && "status" in body) return body;
  throw new Error(`Couldn't send your guess (${res.status})`);
}
