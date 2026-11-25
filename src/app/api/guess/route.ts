import { connection } from "next/server";
import { z } from "zod";
import { game } from "@config/game";
import { currentUserId } from "@/lib/auth/session";
import { deviceIdFrom, gameStore, noStore, serverError } from "@/lib/game/server";
import { submitGuess } from "@/lib/game/service";

const body = z.strictObject({
  puzzleDate: z.iso.date(),
  roundIndex: z.int().min(0).max(game.roundsPerDay - 1),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  choiceId: z.uuid().optional(),
});

const status: Record<string, number> = {
  no_puzzle: 404,
  wrong_day: 409,
  out_of_order: 409,
  already_played: 409,
  bad_guess: 400,
  rate_limited: 429,
};

// Scores one round on the server, stores it, and only then returns the answer.
export async function POST(request: Request) {
  await connection();
  const deviceId = deviceIdFrom(request);
  if (!deviceId) {
    return Response.json(
      { status: "error", code: "bad_guess", message: "Missing device ID." },
      { status: 400, headers: noStore },
    );
  }

  let parsed;
  try {
    parsed = body.safeParse(await request.json());
  } catch {
    parsed = null;
  }
  if (!parsed?.success) {
    return Response.json(
      { status: "error", code: "bad_guess", message: "That guess wasn't in the expected format." },
      { status: 400, headers: noStore },
    );
  }

  const store = gameStore();
  if (!store) return serverError(new Error("Supabase is not configured"));
  try {
    const result = await submitGuess(store, { deviceId, userId: await currentUserId() }, parsed.data);
    const code = result.status === "error" ? (status[result.code] ?? 400) : 200;
    return Response.json(result, { status: code, headers: noStore });
  } catch (err) {
    return serverError(err);
  }
}
