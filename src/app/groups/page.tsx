import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { myGroups } from "@/lib/account/data";
import { currentUserId } from "@/lib/auth/session";
import { Card, Loading, Page } from "@/components/ui/Page";
import { CreateGroupForm } from "./GroupForms";

export const metadata: Metadata = { title: "Groups · Where It Used To Be" };

async function Groups() {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in?next=/groups");
  const groups = await myGroups(userId);
  return (
    <div className="mt-6 space-y-4">
      {groups.length > 0 && (
        <ul className="divide-y divide-divider-soft rounded-card bg-surface shadow-card">
          {groups.map((g) => (
            <li key={g.id}>
              <Link href={`/groups/${g.id}`} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold text-ink">{g.name}</span>
                  <span className="block text-[13px] text-secondary">
                    {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
                    {g.isOwner ? " · You own this group" : ""}
                  </span>
                </span>
                <span aria-hidden="true" className="text-ink">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Card>
        <h2 className="text-[18px] font-bold text-ink">Start a group</h2>
        <p className="mt-1 mb-3 text-[14px] text-body">
          Play against family, friends or co-workers. You&apos;ll get a link to invite them.
        </p>
        <CreateGroupForm />
      </Card>
    </div>
  );
}

export default function GroupsPage() {
  return (
    <Page title="Groups">
      <Suspense fallback={<Loading />}>
        <Groups />
      </Suspense>
    </Page>
  );
}
