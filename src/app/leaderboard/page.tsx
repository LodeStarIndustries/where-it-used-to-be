import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { dayBoard, myGroups } from "@/lib/account/data";
import { currentUserId } from "@/lib/auth/session";
import { puzzleDateFor, puzzleNumberFor } from "@/lib/puzzle-date";
import { DayBoard, Tabs } from "@/components/social/Board";
import { Card, Loading, Page } from "@/components/ui/Page";

export const metadata: Metadata = { title: "Leaderboard · Where It Used To Be" };

async function Leaderboard({ searchParams }: { searchParams: PageProps<"/leaderboard">["searchParams"] }) {
  const params = await searchParams;
  const userId = await currentUserId();
  await connection();
  const today = puzzleDateFor(new Date());
  const groups = userId ? await myGroups(userId) : [];
  const group = groups.find((g) => g.id === params.group) ?? null;
  const board = await dayBoard(today, userId, group?.id ?? null);

  const tabs = [
    { href: "/leaderboard", label: "Today", current: !group },
    ...groups.map((g) => ({ href: `/leaderboard?group=${g.id}`, label: g.name, current: g.id === group?.id })),
  ];

  return (
    <>
      <p className="mt-2 text-[15px] text-body">
        Day #{puzzleNumberFor(today)}. Ties go to whoever finished first.
      </p>
      {groups.length > 0 && <Tabs tabs={tabs} label="Leaderboards" />}

      {!userId && (
        <Card className="mt-4">
          <p className="text-[15px] text-body">
            Guests don&apos;t appear here.{" "}
            <Link href="/sign-in?next=/leaderboard" className="font-semibold text-ink underline underline-offset-2">
              Sign in
            </Link>{" "}
            to get on the board. Today&apos;s game comes with you.
          </p>
        </Card>
      )}

      <Card className="mt-4">
        <h2 className="text-[18px] font-bold text-ink">{group ? group.name : "Everyone, today"}</h2>
        {group && !board.viewerFinished && (
          <p className="mt-1 text-[13px] text-secondary">Finish today&apos;s puzzle to see everyone&apos;s rounds.</p>
        )}
        <DayBoard rows={board.rows} empty="Nobody has finished today's puzzle yet. Be the first." />
        {group && (
          <Link href={`/groups/${group.id}`} className="mt-4 block text-[14px] font-semibold text-ink underline underline-offset-2">
            Group page and this week
          </Link>
        )}
      </Card>
    </>
  );
}

export default function LeaderboardPage(props: PageProps<"/leaderboard">) {
  return (
    <Page title="Leaderboard">
      <Suspense fallback={<Loading />}>
        <Leaderboard searchParams={props.searchParams} />
      </Suspense>
    </Page>
  );
}
