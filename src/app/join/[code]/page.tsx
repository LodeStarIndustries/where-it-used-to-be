import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { groupByCode, isMember } from "@/lib/account/data";
import { joinGroupAction } from "@/lib/account/group-actions";
import { currentUserId } from "@/lib/auth/session";
import { Card, Loading, Page, primaryButtonClass } from "@/components/ui/Page";
import { Submit } from "@/app/groups/GroupForms";

export const metadata: Metadata = { title: "Join a group · Where It Used To Be" };

async function Join({ params, searchParams }: PageProps<"/join/[code]">) {
  const { code } = await params;
  const { error } = await searchParams;
  const [group, userId] = await Promise.all([groupByCode(code), currentUserId()]);

  if (!group) {
    return (
      <Card className="mt-6">
        <p className="text-[15px] text-body">
          This invite link doesn&apos;t work. It may be mistyped, or the group&apos;s owner may have made a new one. Ask
          them for the latest link.
        </p>
      </Card>
    );
  }

  if (userId && (await isMember(group.id, userId))) {
    return (
      <Card className="mt-6">
        <p className="text-[15px] text-body">
          You&apos;re already in <strong className="text-ink">{group.name}</strong>.
        </p>
        <Link href={`/groups/${group.id}`} className={`${primaryButtonClass} mt-4`}>
          Go to the group
        </Link>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <p className="label-caps text-secondary">You&apos;re invited to</p>
      <h2 className="mt-1 text-[22px] font-bold text-ink">{group.name}</h2>
      <p className="mt-1 text-[14px] text-secondary">
        {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
      </p>
      <p className="mt-3 text-[15px] text-body">
        Members see each other&apos;s scores on a group leaderboard, for today and the last 7 days.
      </p>
      {error === "limit" && (
        <p className="mt-3 text-[14px] text-accent" role="alert">
          Too many tries. Wait a while and try again.
        </p>
      )}
      {userId ? (
        <form action={joinGroupAction} className="mt-4">
          <input type="hidden" name="code" value={code} />
          <Submit pendingText="Joining…">Join group</Submit>
        </form>
      ) : (
        <>
          <Link href={`/sign-in?next=${encodeURIComponent(`/join/${code}`)}`} className={`${primaryButtonClass} mt-4`}>
            Sign in to join
          </Link>
          <p className="mt-2 text-[13px] text-secondary">It&apos;s free. Playing never needs an account.</p>
        </>
      )}
    </Card>
  );
}

export default function JoinPage(props: PageProps<"/join/[code]">) {
  return (
    <Page title="Join a group">
      <Suspense fallback={<Loading />}>
        <Join {...props} />
      </Suspense>
    </Page>
  );
}
