import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { maxPointsPerDay } from "@config/game";
import { getProfile, history } from "@/lib/account/data";
import { currentUserId } from "@/lib/auth/session";
import { RoundDots } from "@/components/game/RoundDots";
import { Card, Loading, Page } from "@/components/ui/Page";
import { formatShortDate } from "@/lib/format";
import { DeleteAccountForm, DisplayNameForm, MarketingForm, SignOutButton } from "./ProfileForms";

export const metadata: Metadata = { title: "Profile · Where It Used To Be" };

async function Profile() {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in?next=/profile");
  const [profile, past] = await Promise.all([getProfile(userId), history(userId)]);
  if (!profile) redirect("/sign-in?next=/profile");
  if (!profile.displayName) redirect("/welcome?next=/profile");

  return (
    <div className="mt-6 space-y-4">
      <Card>
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="label-caps text-secondary">Current streak</dt>
            <dd className="mt-1 text-[22px] font-bold text-ink">
              {profile.currentStreak} {profile.currentStreak === 1 ? "day" : "days"}
            </dd>
          </div>
          <div>
            <dt className="label-caps text-secondary">Best streak</dt>
            <dd className="mt-1 text-[22px] font-bold text-ink">
              {profile.bestStreak} {profile.bestStreak === 1 ? "day" : "days"}
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="text-[18px] font-bold text-ink">Past results</h2>
        {past.length === 0 ? (
          <p className="mt-2 text-[15px] text-body">Nothing yet. Your results show up here once you play.</p>
        ) : (
          <ul className="mt-2 divide-y divide-divider-soft">
            {past.map((r) => (
              <li key={r.date} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-[15px] font-semibold text-ink">Day #{r.number}</p>
                  <p className="text-[13px] text-secondary">{formatShortDate(r.date)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[15px] font-bold tabular-nums text-ink">
                    {r.totalPoints}
                    <span className="font-normal text-secondary">/{maxPointsPerDay.toLocaleString("en-CA")}</span>
                  </p>
                  {r.completed ? <RoundDots points={r.roundPoints} /> : <p className="text-[13px] text-secondary">Unfinished</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-6">
        <DisplayNameForm current={profile.displayName} />
        <MarketingForm optedIn={profile.marketingOptIn} />
      </Card>

      <SignOutButton />
      <div className="pt-4">
        <DeleteAccountForm />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Page title="Profile">
      <Suspense fallback={<Loading />}>
        <Profile />
      </Suspense>
    </Page>
  );
}
