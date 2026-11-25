import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseGameStore } from "./supabase-store";
import type { GameStore } from "./store";

export function gameStore(): GameStore | null {
  const db = createAdminClient();
  return db ? supabaseGameStore(db) : null;
}

/** The guest's device ID travels in this header. It's a random UUID kept in local storage. */
export const DEVICE_HEADER = "x-device-id";

const deviceIdSchema = z.uuid();

export function deviceIdFrom(request: Request): string | null {
  const parsed = deviceIdSchema.safeParse(request.headers.get(DEVICE_HEADER));
  return parsed.success ? parsed.data.toLowerCase() : null;
}

export const noStore = { "Cache-Control": "no-store" } as const;

export function serverError(err: unknown) {
  console.error(err);
  return Response.json(
    { status: "error", code: "server", message: "Something went wrong on our side. Try again in a moment." },
    { status: 500, headers: noStore },
  );
}
