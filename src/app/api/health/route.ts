import { connection } from "next/server";
import { checkHealth } from "@/lib/health";

export async function GET() {
  await connection(); // always run at request time
  const health = await checkHealth();
  // Keep setup details out of the public production response.
  const body =
    health.deploy === "production" ? { ok: health.ok, database: health.database, puzzleDate: health.puzzleDate } : health;
  return Response.json(body, {
    status: health.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
