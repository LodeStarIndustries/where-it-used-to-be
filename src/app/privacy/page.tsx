import type { Metadata } from "next";
import { Page } from "@/components/ui/Page";

export const metadata: Metadata = { title: "Privacy · Where It Used To Be" };

// Placeholder copy for Mike to replace (Milestone 5 polishes this page). It
// describes what the app actually stores today; keep it accurate if that changes.
export default function PrivacyPage() {
  return (
    <Page title="Privacy">
      <p className="mt-2 label-caps text-accent">Draft: placeholder copy</p>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-body">
        <p>We keep only what the game needs.</p>
        <h2 className="pt-2 text-[18px] font-bold text-ink">If you play as a guest</h2>
        <p>
          Your browser keeps a random ID (in local storage and a cookie) so your guesses can be scored and your streak
          counted. We store your guesses and scores against that ID. It isn&apos;t linked to your name or anything else
          about you.
        </p>
        <h2 className="pt-2 text-[18px] font-bold text-ink">If you sign in</h2>
        <p>
          We store your email address, the display name you choose, your results, your streaks and the groups you
          belong to. Sign-in uses cookies to keep you signed in. If you sign in with Google, we get your email address
          from Google, nothing else.
        </p>
        <p>
          Your display name and scores appear on leaderboards. Members of your groups see your scores and, once
          they&apos;ve played that day, your round results.
        </p>
        <h2 className="pt-2 text-[18px] font-bold text-ink">Emails</h2>
        <p>
          We email you a sign-in link when you ask for one. We only send other emails, about the game and new features,
          if you tick the box to say yes. It starts unticked, and you can change it any time in your profile. We record
          when you made that choice.
        </p>
        <h2 className="pt-2 text-[18px] font-bold text-ink">Deleting your account</h2>
        <p>
          Delete your account from your profile. It removes your profile, your signed-in results, your group
          memberships and any groups you own.
        </p>
        <h2 className="pt-2 text-[18px] font-bold text-ink">Visit counts</h2>
        <p>
          We count visits with Vercel Web Analytics and Speed Insights, run by our hosting provider. They use no cookies
          and don&apos;t identify you: they record the pages viewed, how quickly pages load, and general details like
          device type, browser and country, so we can see how the game is used and keep it fast.
        </p>
        <h2 className="pt-2 text-[18px] font-bold text-ink">No ads</h2>
        <p>There are no ads, and we don&apos;t sell or share your information.</p>
      </div>
      <p className="mt-8 text-[12px] text-secondary">
        Map data © OpenStreetMap contributors, served by OpenFreeMap with OpenMapTiles.
      </p>
    </Page>
  );
}
