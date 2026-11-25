import "server-only";
import { deployEnvironment, publicSupabaseEnv } from "@/lib/env";
import { puzzleDateFor, puzzleNumberFor } from "@/lib/puzzle-date";
import { createAdminClient } from "@/lib/supabase/admin";

export interface Health {
  ok: boolean;
  deploy: ReturnType<typeof deployEnvironment>;
  puzzleDate: string;
  puzzleNumber: number;
  database: "connected" | "not configured" | "error";
  /** What the database says it is (app_settings.environment). */
  databaseEnvironment: string | null;
  problems: string[];
}

/** Checks the deployment is wired to the right database. Never returns secrets. */
export async function checkHealth(): Promise<Health> {
  const deploy = deployEnvironment();
  const puzzleDate = puzzleDateFor();
  const problems: string[] = [];
  let database: Health["database"] = "not configured";
  let databaseEnvironment: string | null = null;

  const admin = createAdminClient();
  if (!publicSupabaseEnv()) problems.push("NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing");
  if (!process.env.SUPABASE_SECRET_KEY) problems.push("SUPABASE_SECRET_KEY is missing");

  if (admin) {
    const { data, error } = await admin.from("app_settings").select("environment").single();
    if (error) {
      database = "error";
      problems.push(`Database query failed (have the migrations been pushed?): ${error.message}`);
    } else {
      database = "connected";
      databaseEnvironment = data.environment;
      const expected = deploy === "production" ? "production" : "development";
      if (data.environment !== expected) {
        problems.push(
          `This ${deploy} deployment should use the ${expected} database, but the database says "${data.environment}"`,
        );
      }
    }
  }

  return {
    ok: problems.length === 0,
    deploy,
    puzzleDate,
    puzzleNumber: puzzleNumberFor(puzzleDate),
    database,
    databaseEnvironment,
    problems,
  };
}
