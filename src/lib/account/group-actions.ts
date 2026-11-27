"use server";
// Group actions. Every one checks the session, and owner-only actions are
// checked again in data.ts, so a forged form can't act on someone else's group.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { game } from "@config/game";
import { currentUserId } from "@/lib/auth/session";
import type { FormState } from "@/lib/auth/actions";
import {
  checkGroupName,
  createGroup,
  deleteGroup,
  groupByCode,
  joinGroup,
  leaveGroup,
  rateLimit,
  regenerateInviteCode,
  removeMember,
  renameGroup,
} from "./data";

async function requireUser(next: string) {
  const userId = await currentUserId();
  if (!userId) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return userId;
}

const uuid = z.uuid();
function groupIdFrom(formData: FormData) {
  const parsed = uuid.safeParse(formData.get("groupId"));
  if (!parsed.success) throw new Error("Bad group ID");
  return parsed.data;
}

export async function createGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUser("/groups");
  const name = checkGroupName(formData.get("name"));
  if (!name.ok) return { status: "error", message: name.message };
  if (!(await rateLimit(`group-create:${userId}`, 86400, game.rateLimits.groupsCreatedPerDayPerPlayer))) {
    return { status: "error", message: "You've made a lot of groups today. Try again tomorrow." };
  }
  const id = await createGroup(userId, name.name);
  redirect(`/groups/${id}?created=1`);
}

export async function joinGroupAction(formData: FormData) {
  const code = String(formData.get("code") ?? "");
  const userId = await requireUser(`/join/${encodeURIComponent(code)}`);
  if (!(await rateLimit(`group-join:${userId}`, 3600, game.rateLimits.groupJoinsPerHourPerPlayer))) {
    redirect(`/join/${encodeURIComponent(code)}?error=limit`);
  }
  const group = await groupByCode(code);
  if (!group) redirect(`/join/${encodeURIComponent(code)}`);
  await joinGroup(group.id, userId);
  redirect(`/groups/${group.id}`);
}

export async function leaveGroupAction(formData: FormData) {
  const groupId = groupIdFrom(formData);
  const userId = await requireUser(`/groups/${groupId}`);
  await leaveGroup(groupId, userId);
  revalidatePath("/groups");
  redirect("/groups");
}

export async function renameGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const groupId = groupIdFrom(formData);
  const userId = await requireUser(`/groups/${groupId}`);
  const name = checkGroupName(formData.get("name"));
  if (!name.ok) return { status: "error", message: name.message };
  await renameGroup(groupId, userId, name.name);
  revalidatePath(`/groups/${groupId}`);
  return { status: "saved", message: "Renamed." };
}

export async function regenerateInviteAction(formData: FormData) {
  const groupId = groupIdFrom(formData);
  const userId = await requireUser(`/groups/${groupId}`);
  await regenerateInviteCode(groupId, userId);
  revalidatePath(`/groups/${groupId}`);
}

export async function removeMemberAction(formData: FormData) {
  const groupId = groupIdFrom(formData);
  const member = uuid.parse(formData.get("memberId"));
  const userId = await requireUser(`/groups/${groupId}`);
  await removeMember(groupId, userId, member);
  revalidatePath(`/groups/${groupId}`);
}

export async function deleteGroupAction(formData: FormData) {
  const groupId = groupIdFrom(formData);
  const userId = await requireUser(`/groups/${groupId}`);
  await deleteGroup(groupId, userId);
  revalidatePath("/groups");
  redirect("/groups");
}
