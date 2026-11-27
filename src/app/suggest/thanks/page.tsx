import type { Metadata } from "next";
import Link from "next/link";
import { Page, primaryButtonClass, secondaryButtonClass } from "@/components/ui/Page";

export const metadata: Metadata = { title: "Thanks · Where It Used To Be" };

export default function ThanksPage() {
  return (
    <Page title="Thanks!">
      <p className="mt-3 text-[15px] text-body">
        We&apos;ve got your suggestion. We check every one before it goes into the game, so it may take a while. You can
        see its status in your profile.
      </p>
      <div className="mt-6 space-y-3">
        <Link href="/suggest" className={primaryButtonClass}>
          Suggest another place
        </Link>
        <Link href="/profile" className={secondaryButtonClass}>
          Your profile
        </Link>
      </div>
    </Page>
  );
}
