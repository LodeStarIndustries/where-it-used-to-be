// Environment helpers. See SETUP.md for every variable and where it comes from.

/** Which Vercel environment this is: production, preview or development (local). */
export function deployEnvironment(): "production" | "preview" | "development" {
  const v = process.env.VERCEL_ENV;
  if (v === "production" || v === "preview") return v;
  return "development";
}

export function publicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && publishableKey ? { url, publishableKey } : null;
}
