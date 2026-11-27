"use client";
// Browser side: the guest's device ID and calls to the game API.
import type { GuessInput, GuessResponse, TodayResponse } from "./types";

const KEY = "wiutb.deviceId";
/** Mirrors the device ID for the server (see DEVICE_COOKIE in lib/auth/session.ts). */
const COOKIE = "wiutb_device";
let memoryId: string | null = null;

function writeCookie(id: string) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${id}; Path=/; Max-Age=${60 * 60 * 24 * 400}; SameSite=Lax${secure}`;
}

/**
 * A random UUID kept in local storage, so a guest's plays are scored and stored
 * on the server. A cookie carries the same ID, so signing in can link them.
 */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    if (!document.cookie.includes(`${COOKIE}=${id}`)) writeCookie(id);
    return id;
  } catch {
    // Private mode or blocked storage: still playable for this visit.
    memoryId ??= crypto.randomUUID();
    return memoryId;
  }
}

/** After signing out, this browser starts again as a new guest. */
export function resetDeviceId() {
  memoryId = null;
  try {
    localStorage.removeItem(KEY);
  } catch {}
  document.cookie = `${COOKIE}=; Path=/; Max-Age=0`;
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
