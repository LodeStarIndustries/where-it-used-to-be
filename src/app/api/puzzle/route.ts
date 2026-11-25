import { connection } from "next/server";
import { currentUserId } from "@/lib/auth/session";
import { deviceIdFrom, gameStore, noStore, serverError } from "@/lib/game/server";
import { getToday } from "@/lib/game/service";

// Today's puzzle, as the player sees it: question fields only for unplayed rounds,
// plus the player's results so far (so a reload picks up where it left off).
export async function GET(request: Request) {
  await connection();
  const store = gameStore();
  if (!store) return serverError(new Error("Supabase is not configured"));
  try {
    const today = await getToday(store, { deviceId: deviceIdFrom(request), userId: await currentUserId() });
    return Response.json(today, { headers: noStore });
  } catch (err) {
    return serverError(err);
  }
}
