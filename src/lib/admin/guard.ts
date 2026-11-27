import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { currentUserId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

/** True when this user's profile has is_admin. Checked against the database every request. */
const isAdmin = cache(async (userId: string): Promise<boolean> => {
  const db = createAdminClient();
  if (!db) return false;
  const { data } = await db.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  return data?.is_admin === true;
});

/**
 * For admin pages: signed-out visitors go to sign-in; signed-in players who
 * aren't admins get a 404, so the admin area doesn't advertise itself.
 */
export async function requireAdminPage(path: string): Promise<string> {
  const userId = await currentUserId();
  if (!userId) redirect(`/sign-in?next=${encodeURIComponent(path)}`);
  if (!(await isAdmin(userId))) notFound();
  return userId;
}

export class NotAdminError extends Error {
  constructor() {
    super("Admins only");
  }
}

/** For admin server actions and route handlers. Throws unless the caller is an admin. */
export async function assertAdmin(): Promise<string> {
  const userId = await currentUserId();
  if (!userId || !(await isAdmin(userId))) throw new NotAdminError();
  return userId;
}

/** For showing an Admin link to admins only. */
export async function viewerIsAdmin(): Promise<boolean> {
  const userId = await currentUserId();
  return userId ? isAdmin(userId) : false;
}
