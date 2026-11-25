import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicSupabaseEnv } from "@/lib/env";

/**
 * Supabase client acting as the signed-in player, using the session cookies.
 * Used only for auth (sign-in, session, sign-out). Game data goes through the
 * server's secret-key client, with the user ID taken from the verified session.
 */
export async function createSessionClient() {
  const env = publicSupabaseEnv();
  if (!env) throw new Error("Supabase is not configured");
  const store = await cookies();
  return createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          // Called from a Server Component, which can't set cookies. The proxy
          // refreshes the session on the next request instead.
        }
      },
    },
  });
}
