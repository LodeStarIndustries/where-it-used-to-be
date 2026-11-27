import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { dayBoard, groupForMember, weekBoard } from "@/lib/account/data";
import {
  deleteGroupAction,
  leaveGroupAction,
  regenerateInviteAction,
  removeMemberAction,
} from "@/lib/account/group-actions";
import { currentUserId, requestOrigin } from "@/lib/auth/session";
import { formatShortDate } from "@/lib/format";
import { puzzleDateFor } from "@/lib/puzzle-date";
import { DayBoard, Tabs, WeekBoard } from "@/components/social/Board";
import { BackLink, Card, Loading, secondaryButtonClass } from "@/components/ui/Page";
import { ConfirmSubmit, InviteLink, RenameGroupForm } from "../GroupForms";

export const metadata: Metadata = { title: "Group · Where It Used To Be" };

async function Group({ params, searchParams }: PageProps<"/groups/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const userId = await currentUserId();
  if (!userId) redirect(`/sign-in?next=/groups/${id}`);
  const group = await groupForMember(id, userId);
  if (!group) notFound();

  await connection();
  const today = puzzleDateFor(new Date());
  const view = query.view === "week" ? "week" : "today";
  const [day, week, origin] = await Promise.all([
    view === "today" ? dayBoard(today, userId, group.id) : null,
    view === "week" ? weekBoard(group.id, today, userId) : null,
    requestOrigin(),
  ]);
  const inviteUrl = `${origin}/join/${group.inviteCode}`;

  return (
    <>
      <h1 className="mt-4 text-[28px] font-bold leading-tight text-ink">{group.name}</h1>
      {query.created && (
        <p className="mt-2 text-[15px] text-body" role="status">
          Your group is ready. Share the invite link below to bring people in.
        </p>
      )}

      <Tabs
        label="Group boards"
        tabs={[
          { href: `/groups/${group.id}`, label: "Today", current: view === "today" },
          { href: `/groups/${group.id}?view=week`, label: "Last 7 days", current: view === "week" },
        ]}
      />
      <Card className="mt-4">
        {day && (
          <>
            {!day.viewerFinished && (
              <p className="text-[13px] text-secondary">Finish today&apos;s puzzle to see everyone&apos;s rounds.</p>
            )}
            <DayBoard rows={day.rows} empty="Nobody in this group has finished today's puzzle yet." />
          </>
        )}
        {week && (
          <>
            <p className="text-[13px] text-secondary">
              {formatShortDate(week.from)} to {formatShortDate(today)}, total points.
            </p>
            <WeekBoard rows={week.rows} />
          </>
        )}
      </Card>

      <Card className="mt-4">
        <h2 className="text-[18px] font-bold text-ink">Invite people</h2>
        <p className="mt-1 mb-3 text-[14px] text-body">Anyone with this link can join after signing in.</p>
        <InviteLink url={inviteUrl} groupName={group.name} />
        {group.isOwner && (
          <form action={regenerateInviteAction} className="mt-2">
            <input type="hidden" name="groupId" value={group.id} />
            <ConfirmSubmit
              question="Make a new invite link? The old one will stop working."
              className="text-[14px] font-semibold text-ink underline underline-offset-2"
            >
              Make a new link
            </ConfirmSubmit>
          </form>
        )}
      </Card>

      <Card className="mt-4">
        <h2 className="text-[18px] font-bold text-ink">
          Members <span className="font-normal text-secondary">({group.members.length})</span>
        </h2>
        <ul className="mt-2 divide-y divide-divider-soft">
          {group.members.map((m) => (
            <li key={m.userId} className="flex min-h-11 items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate text-[15px] text-ink">
                {m.displayName}
                {m.isMe && <span className="text-secondary"> (you)</span>}
                {m.isOwner && <span className="text-secondary"> · Owner</span>}
              </span>
              {group.isOwner && !m.isMe && (
                <form action={removeMemberAction}>
                  <input type="hidden" name="groupId" value={group.id} />
                  <input type="hidden" name="memberId" value={m.userId} />
                  <ConfirmSubmit
                    question={`Remove ${m.displayName} from the group?`}
                    className="text-[14px] font-semibold text-accent underline underline-offset-2"
                  >
                    Remove<span className="sr-only"> {m.displayName}</span>
                  </ConfirmSubmit>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {group.isOwner ? (
        <Card className="mt-4 space-y-4">
          <RenameGroupForm groupId={group.id} name={group.name} />
          <form action={deleteGroupAction}>
            <input type="hidden" name="groupId" value={group.id} />
            <ConfirmSubmit
              question="Delete this group for everyone? This can't be undone."
              className="text-[15px] font-semibold text-accent underline underline-offset-2"
            >
              Delete group
            </ConfirmSubmit>
          </form>
        </Card>
      ) : (
        <form action={leaveGroupAction} className="mt-6">
          <input type="hidden" name="groupId" value={group.id} />
          <ConfirmSubmit question="Leave this group?" className={secondaryButtonClass}>
            Leave group
          </ConfirmSubmit>
        </form>
      )}
    </>
  );
}

export default function GroupPage(props: PageProps<"/groups/[id]">) {
  return (
    <main className="mx-auto w-full max-w-[430px] px-4 pb-12 pt-6">
      <BackLink href="/groups" label="Groups" />
      <Suspense fallback={<Loading />}>
        <Group {...props} />
      </Suspense>
    </main>
  );
}
