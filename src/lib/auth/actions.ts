"use server";
// Sign-in, first-time setup and account actions. Each one checks the session
// on the server; nothing trusts a user ID sent by the browser.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { game } from "@config/game";
import {
  checkDisplayName,
  deleteAccount,
  rateLimit,
  setDisplayName,
  setMarketingOptIn,
} from "@/lib/account/data";
import { createSessionClient } from "@/lib/supabase/server";
import { currentUserId, requestOrigin, safeNext } from "./session";

export type FormState = { status: "idle" | "error" | "sent" | "saved"; message?: string; email?: string };


async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

const confirmUrl = async (next: string) => `${await requestOrigin()}/auth/confirm?next=${encodeURIComponent(next)}`;

export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: await confirmUrl(next) },
  });
  if (error || !data.url) redirect(`/sign-in?error=google&next=${encodeURIComponent(next)}`);
  redirect(data.url);
}

const emailSchema = z.email().max(254);

export async function sendMagicLink(_prev: FormState, formData: FormData): Promise<FormState> {
  const next = safeNext(formData.get("next"));
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { status: "error", message: "Enter a valid email address." };
  const email = parsed.data;

  const [byIp, byAddress] = await Promise.all([
    rateLimit(`signin-ip:${await clientIp()}`, 3600, game.rateLimits.signInEmailsPerHourPerIp),
    rateLimit(`signin-email:${email}`, 3600, game.rateLimits.signInEmailsPerHourPerAddress),
  ]);
  if (!byIp || !byAddress) {
    return { status: "error", message: "Too many sign-in emails. Wait an hour and try again." };
  }

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: await confirmUrl(next), shouldCreateUser: true },
  });
  if (error) {
    console.error("Magic link:", error.message);
    return {
      status: "error",
      message:
        error.status === 429
          ? "Too many sign-in emails. Wait a few minutes and try again."
          : "Couldn't send the email. Try again in a moment.",
    };
  }
  return { status: "sent", email };
}

async function requireUser(next = "/") {
  const userId = await currentUserId();
  if (!userId) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return userId;
}

/** First sign-in: pick a display name, and choose whether to get emails (unticked by default). */
export async function saveWelcome(_prev: FormState, formData: FormData): Promise<FormState> {
  const next = safeNext(formData.get("next"));
  const userId = await requireUser(`/welcome?next=${encodeURIComponent(next)}`);
  const name = checkDisplayName(formData.get("displayName"));
  if (!name.ok) return { status: "error", message: name.message };
  if ((await setDisplayName(userId, name.name)) === "taken") {
    return { status: "error", message: "Someone already has that name. Try another." };
  }
  if (formData.get("marketingOptIn") === "on") await setMarketingOptIn(userId, true);
  redirect(next);
}

export async function updateDisplayName(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUser("/profile");
  const name = checkDisplayName(formData.get("displayName"));
  if (!name.ok) return { status: "error", message: name.message };
  if ((await setDisplayName(userId, name.name)) === "taken") {
    return { status: "error", message: "Someone already has that name. Try another." };
  }
  return { status: "saved", message: "Saved." };
}

export async function updateMarketingOptIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUser("/profile");
  await setMarketingOptIn(userId, formData.get("marketingOptIn") === "on");
  return { status: "saved", message: "Saved." };
}

export async function signOut() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut({ scope: "local" });
}

export async function deleteMyAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUser("/profile");
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") {
    return { status: "error", message: "Type DELETE to confirm." };
  }
  await deleteAccount(userId);
  const supabase = await createSessionClient();
  await supabase.auth.signOut({ scope: "local" });
  // The account's plays are gone, so this browser simply carries on as a guest.
  redirect("/");
}
