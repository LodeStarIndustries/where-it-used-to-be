// Dev database only: signs a Playwright page in as a TEST: account without
// sending email, using a one-time link made with the server key.
import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

const DEV_REF = "igclemmromezcgmxucov";

export function canSignIn(): boolean {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    return false;
  }
  return !process.env.E2E_BASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes(DEV_REF);
}

export async function signInAs(page: Page, email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!url.includes(DEV_REF)) throw new Error("Test sign-in only works against the dev database.");
  const db = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  await page.goto(`/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink&next=%2F`);
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}
