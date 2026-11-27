// Rules for names players choose. Pure functions, so they're easy to test.
import { isOffensive } from "./profanity";

export type NameCheck = { ok: true; name: string } | { ok: false; message: string };

/** Display names: 2 to 24 characters after trimming, spaces collapsed. */
export function checkDisplayName(raw: unknown): NameCheck {
  if (typeof raw !== "string") return { ok: false, message: "Enter a display name." };
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < 2) return { ok: false, message: "Use at least 2 characters." };
  if (name.length > 24) return { ok: false, message: "Use 24 characters or fewer." };
  if (/[<>]/.test(name) || /[\u0000-\u001f]/.test(name)) return { ok: false, message: "Use letters, numbers and spaces." };
  if (isOffensive(name)) return { ok: false, message: "That name isn't allowed. Try another." };
  return { ok: true, name };
}

export type GroupNameCheck = { ok: true; name: string } | { ok: false; message: string };
export function checkGroupName(raw: unknown): GroupNameCheck {
  if (typeof raw !== "string") return { ok: false, message: "Enter a group name." };
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name) return { ok: false, message: "Enter a group name." };
  if (name.length > 40) return { ok: false, message: "Use 40 characters or fewer." };
  if (/[<>]/.test(name) || /[\u0000-\u001f]/.test(name)) return { ok: false, message: "Use letters, numbers and spaces." };
  if (isOffensive(name)) return { ok: false, message: "That name isn't allowed. Try another." };
  return { ok: true, name };
}
