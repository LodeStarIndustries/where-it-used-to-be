import "server-only";
// Accounts, groups and leaderboards. Runs on the server with the secret key, so
// every function takes the signed-in user's ID (from a verified session) and
// checks membership or ownership itself.
import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { game } from "@config/game";
import { puzzleDateFor, addDays } from "@/lib/puzzle-date";
import { createAdminClient } from "@/lib/supabase/admin";
export { checkDisplayName, checkGroupName } from "./names";
import { streakFrom } from "@/lib/game/service";

function db(): SupabaseClient {
  const client = createAdminClient();
  if (!client) throw new Error("Supabase is not configured");
  return client;
}

function check<T>(result: { data: T; error: { message: string; code?: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export interface Profile {
  id: string;
  displayName: string | null;
  isAdmin: boolean;
  currentStreak: number;
  bestStreak: number;
  marketingOptIn: boolean;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const client = db();
  const [row, dates] = await Promise.all([
    client
      .from("profiles")
      .select("id, display_name, is_admin, best_streak, marketing_opt_in")
      .eq("id", userId)
      .maybeSingle(),
    client
      .from("plays")
      .select("puzzle_date")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .order("puzzle_date", { ascending: false })
      .limit(400),
  ]);
  const p = check(row, "Reading the profile");
  if (!p) return null;
  // The current streak depends on today's date, so it's worked out on read.
  const current = streakFrom(
    (check(dates, "Reading the streak") ?? []).map((r) => r.puzzle_date as string),
    puzzleDateFor(new Date()),
  );
  return {
    id: p.id,
    displayName: p.display_name,
    isAdmin: p.is_admin,
    currentStreak: current,
    bestStreak: Math.max(p.best_streak, current),
    marketingOptIn: p.marketing_opt_in,
  };
}

/** "taken" when another player already uses the name (ignoring case and spaces). */
export async function setDisplayName(userId: string, name: string): Promise<"ok" | "taken"> {
  const { error } = await db().from("profiles").update({ display_name: name }).eq("id", userId);
  if (!error) return "ok";
  if (error.code === "23505") return "taken";
  throw new Error(`Saving the display name: ${error.message}`);
}

/** Records the choice and when it was made. */
export async function setMarketingOptIn(userId: string, optIn: boolean) {
  check(
    await db()
      .from("profiles")
      .update({ marketing_opt_in: optIn, marketing_opt_in_at: new Date().toISOString() })
      .eq("id", userId),
    "Saving the email preference",
  );
}

export interface PastResult {
  date: string;
  number: number;
  totalPoints: number;
  completed: boolean;
  roundPoints: number[];
}

export async function history(userId: string, limit = 60): Promise<PastResult[]> {
  const rows = check(
    await db()
      .from("plays")
      .select("puzzle_date, total_points, completed_at, daily_puzzles (number), play_rounds (round_index, points)")
      .eq("user_id", userId)
      .order("puzzle_date", { ascending: false })
      .limit(limit),
    "Reading past results",
  ) as unknown as {
    puzzle_date: string;
    total_points: number;
    completed_at: string | null;
    daily_puzzles: { number: number } | null;
    play_rounds: { round_index: number; points: number }[];
  }[];
  return rows.map((r) => ({
    date: r.puzzle_date,
    number: r.daily_puzzles?.number ?? 0,
    totalPoints: r.total_points,
    completed: r.completed_at !== null,
    roundPoints: [...r.play_rounds].sort((a, b) => a.round_index - b.round_index).map((x) => x.points),
  }));
}

/**
 * Removes the account. The database cascades this to the profile, plays and
 * rounds, suggestions, group memberships and any groups the player owns.
 */
export async function deleteAccount(userId: string) {
  // Their suggestions go with the account (the database cascades), so remove those photos from storage first.
  const photos = check(
    await db().from("submissions").select("photo_path").eq("user_id", userId).not("photo_path", "is", null),
    "Reading suggestion photos",
  ) as { photo_path: string }[];
  if (photos.length) await db().storage.from("photos").remove(photos.map((p) => p.photo_path));
  const { error } = await db().auth.admin.deleteUser(userId);
  if (error) throw new Error(`Deleting the account: ${error.message}`);
}

export async function rateLimit(key: string, windowSeconds: number, max: number): Promise<boolean> {
  const data = check(
    await db().rpc("rate_limit_hit", { p_key: key, p_window_seconds: windowSeconds, p_max: max }),
    "Rate limit",
  );
  return data === true;
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

// No 0/O or 1/l/I, so codes are easy to read aloud. Matches the table's check.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
export function newInviteCode(): string {
  return Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}
export const isInviteCode = (code: string) => /^[A-Za-z0-9]{8}$/.test(code);

export interface GroupSummary {
  id: string;
  name: string;
  isOwner: boolean;
  memberCount: number;
}

export async function myGroups(userId: string): Promise<GroupSummary[]> {
  const rows = check(
    await db()
      .from("group_members")
      .select("joined_at, groups!inner (id, name, owner_id, group_members (count))")
      .eq("user_id", userId)
      .order("joined_at"),
    "Reading groups",
  ) as unknown as {
    groups: { id: string; name: string; owner_id: string; group_members: { count: number }[] };
  }[];
  return rows.map(({ groups: g }) => ({
    id: g.id,
    name: g.name,
    isOwner: g.owner_id === userId,
    memberCount: g.group_members[0]?.count ?? 0,
  }));
}

export interface GroupDetail {
  id: string;
  name: string;
  inviteCode: string;
  isOwner: boolean;
  members: { userId: string; displayName: string; isOwner: boolean; isMe: boolean }[];
}

/** The group, if the player is a member; null otherwise. */
export async function groupForMember(groupId: string, userId: string): Promise<GroupDetail | null> {
  const row = check(
    await db()
      .from("groups")
      .select("id, name, invite_code, owner_id, group_members (user_id, joined_at, profiles (display_name))")
      .eq("id", groupId)
      .maybeSingle(),
    "Reading the group",
  ) as unknown as {
    id: string;
    name: string;
    invite_code: string;
    owner_id: string;
    group_members: { user_id: string; joined_at: string; profiles: { display_name: string | null } | null }[];
  } | null;
  if (!row || !row.group_members.some((m) => m.user_id === userId)) return null;
  return {
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    isOwner: row.owner_id === userId,
    members: [...row.group_members]
      .sort((a, b) => a.joined_at.localeCompare(b.joined_at))
      .map((m) => ({
        userId: m.user_id,
        displayName: m.profiles?.display_name ?? "New player",
        isOwner: m.user_id === row.owner_id,
        isMe: m.user_id === userId,
      })),
  };
}

export async function groupByCode(code: string): Promise<{ id: string; name: string; memberCount: number } | null> {
  if (!isInviteCode(code)) return null;
  const row = check(
    await db().from("groups").select("id, name, group_members (count)").eq("invite_code", code).maybeSingle(),
    "Reading the invite",
  ) as unknown as { id: string; name: string; group_members: { count: number }[] } | null;
  return row ? { id: row.id, name: row.name, memberCount: row.group_members[0]?.count ?? 0 } : null;
}

export async function isMember(groupId: string, userId: string): Promise<boolean> {
  const rows = check(
    await db().from("group_members").select("user_id").eq("group_id", groupId).eq("user_id", userId).limit(1),
    "Checking membership",
  );
  return (rows ?? []).length > 0;
}

/** Creates the group with the player as owner and first member. Returns its ID. */
export async function createGroup(userId: string, name: string): Promise<string> {
  const client = db();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await client
      .from("groups")
      .insert({ name, owner_id: userId, invite_code: newInviteCode() })
      .select("id")
      .single();
    if (error?.code === "23505") continue; // Invite code clash: try another.
    if (error) throw new Error(`Creating the group: ${error.message}`);
    check(await client.from("group_members").insert({ group_id: data.id, user_id: userId }), "Joining the group");
    return data.id;
  }
  throw new Error("Creating the group: couldn't find a free invite code");
}

export async function joinGroup(groupId: string, userId: string) {
  const { error } = await db().from("group_members").insert({ group_id: groupId, user_id: userId });
  if (error && error.code !== "23505") throw new Error(`Joining the group: ${error.message}`);
}

async function ownedGroup(groupId: string, userId: string) {
  const row = check(
    await db().from("groups").select("id").eq("id", groupId).eq("owner_id", userId).maybeSingle(),
    "Checking the owner",
  );
  return row !== null;
}

/** Members leave; owners delete the group instead (they can't leave it ownerless). */
export async function leaveGroup(groupId: string, userId: string) {
  if (await ownedGroup(groupId, userId)) throw new Error("The owner can't leave their own group");
  check(
    await db().from("group_members").delete().eq("group_id", groupId).eq("user_id", userId),
    "Leaving the group",
  );
}

export async function renameGroup(groupId: string, ownerId: string, name: string) {
  if (!(await ownedGroup(groupId, ownerId))) throw new Error("Only the owner can rename the group");
  check(await db().from("groups").update({ name }).eq("id", groupId), "Renaming the group");
}

export async function regenerateInviteCode(groupId: string, ownerId: string) {
  if (!(await ownedGroup(groupId, ownerId))) throw new Error("Only the owner can change the invite link");
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await db().from("groups").update({ invite_code: newInviteCode() }).eq("id", groupId);
    if (!error) return;
    if (error.code !== "23505") throw new Error(`Changing the invite code: ${error.message}`);
  }
  throw new Error("Changing the invite code: couldn't find a free code");
}

export async function removeMember(groupId: string, ownerId: string, memberId: string) {
  if (memberId === ownerId) throw new Error("The owner can't remove themselves");
  if (!(await ownedGroup(groupId, ownerId))) throw new Error("Only the owner can remove members");
  check(
    await db().from("group_members").delete().eq("group_id", groupId).eq("user_id", memberId),
    "Removing the member",
  );
}

export async function deleteGroup(groupId: string, ownerId: string) {
  if (!(await ownedGroup(groupId, ownerId))) throw new Error("Only the owner can delete the group");
  check(await db().from("groups").delete().eq("id", groupId), "Deleting the group");
}

// ---------------------------------------------------------------------------
// Leaderboards
// ---------------------------------------------------------------------------

export interface BoardRow {
  rank: number;
  displayName: string;
  totalPoints: number;
  isMe: boolean;
  /** Group boards only, and only once the viewer has finished today. */
  roundPoints: number[] | null;
}

/**
 * One day's board: the top players plus the viewer's own row. On group boards,
 * members see each other's rounds only after finishing today themselves.
 */
export async function dayBoard(date: string, viewerId: string | null, groupId: string | null = null) {
  const rows = check(
    await db().rpc("leaderboard_day", {
      p_date: date,
      p_viewer: viewerId,
      p_group: groupId,
      p_limit: game.leaderboard.topN,
    }),
    "Reading the leaderboard",
  ) as { rank: number; display_name: string; total_points: number; is_me: boolean; round_points: number[] | null }[];
  const viewerFinished = rows.some((r) => r.is_me);
  const showRounds = groupId !== null && viewerFinished;
  return {
    viewerFinished,
    rows: rows.map(
      (r): BoardRow => ({
        rank: Number(r.rank),
        displayName: r.display_name,
        totalPoints: r.total_points,
        isMe: r.is_me,
        roundPoints: showRounds ? (r.round_points ?? []) : null,
      }),
    ),
  };
}

export interface WeekRow {
  rank: number;
  displayName: string;
  totalPoints: number;
  daysPlayed: number;
  isMe: boolean;
}

/** A group's board for the last 7 puzzle dates, ending today. */
export async function weekBoard(groupId: string, today: string, viewerId: string) {
  const rows = check(
    await db().rpc("leaderboard_group_week", { p_group: groupId, p_end: today, p_viewer: viewerId }),
    "Reading the week",
  ) as { rank: number; display_name: string; total_points: number; days_played: number; is_me: boolean }[];
  return {
    from: addDays(today, -(game.leaderboard.groupHistoryDays - 1)),
    rows: rows.map(
      (r): WeekRow => ({
        rank: Number(r.rank),
        displayName: r.display_name,
        totalPoints: Number(r.total_points),
        daysPlayed: r.days_played,
        isMe: r.is_me,
      }),
    ),
  };
}
