import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { deviceIdFromCookie, safeNext } from "@/lib/auth/session";
import { gameStore } from "@/lib/game/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";

const otpTypes: EmailOtpType[] = ["email", "magiclink", "signup", "invite", "recovery", "email_change"];

// Where sign-in lands: the email link (token_hash) or Google (code). On success
// it links this device's guest plays to the account, then asks a new player for
// a display name.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/sign-in?error=${reason}&next=${encodeURIComponent(next)}`, url));

  const supabase = await createSessionClient();
  let userId: string | null = null;
  if (tokenHash && type && otpTypes.includes(type)) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      console.error("Sign-in link:", error.code ?? error.message);
      return fail("link");
    }
    userId = data.user?.id ?? null;
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("Sign-in code:", error.code ?? error.message);
      return fail("link");
    }
    userId = data.user?.id ?? null;
  } else {
    return fail(url.searchParams.get("error") === "access_denied" ? "cancelled" : "link");
  }
  if (!userId) return fail("link");

  try {
    const device = await deviceIdFromCookie();
    const store = gameStore();
    if (device && store) await store.linkDevice(device, userId);
  } catch (err) {
    // Not fatal: the next puzzle load links the device too.
    console.error(err);
  }

  const db = createAdminClient();
  const profile = db ? (await db.from("profiles").select("display_name").eq("id", userId).maybeSingle()).data : null;
  const dest = profile?.display_name ? next : `/welcome?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(new URL(dest, url));
}
