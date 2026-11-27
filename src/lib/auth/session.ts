import "server-only";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import { z } from "zod";
import { createSessionClient } from "@/lib/supabase/server";

/** The device ID is also kept in this cookie, so the server can link guest plays at sign-in. */
export const DEVICE_COOKIE = "wiutb_device";

/** The signed-in player's user ID, from a verified session, or null for a guest. */
export const currentUserId = cache(async (): Promise<string | null> => {
  const store = await cookies();
  // No Supabase cookie means no session: skip the work.
  if (!store.getAll().some((c) => c.name.startsWith("sb-"))) return null;
  // Checking the token reads the clock, so it must happen per request, never in a prerender.
  await connection();
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return null;
  return data.claims.sub;
});

/** The guest device ID from the cookie, if it's a valid UUID. */
export async function deviceIdFromCookie(): Promise<string | null> {
  const parsed = z.uuid().safeParse((await cookies()).get(DEVICE_COOKIE)?.value);
  return parsed.success ? parsed.data.toLowerCase() : null;
}

/** Only same-site paths are allowed as a place to go after sign-in. */
export function safeNext(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value;
}

/** This deployment's origin, from the request (works on localhost, previews and production). */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
