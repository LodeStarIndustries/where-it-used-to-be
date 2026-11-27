import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getProfile } from "@/lib/account/data";
import { currentUserId } from "@/lib/auth/session";
import { Loading, Page } from "@/components/ui/Page";
import { SuggestForm } from "./SuggestForm";

export const metadata: Metadata = { title: "Suggest a place · Where It Used To Be" };

async function Suggest() {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in?next=/suggest");
  const profile = await getProfile(userId);
  if (!profile?.displayName) redirect("/welcome?next=/suggest");
  return <SuggestForm />;
}

export default function SuggestPage() {
  return (
    <Page title="Suggest a place">
      <p className="mt-2 text-[15px] text-body">
        Know a Saint John business that&apos;s gone? Tell us where it was. Businesses and public places only, please:
        no homes, and no private people.
      </p>
      <Suspense fallback={<Loading />}>
        <Suggest />
      </Suspense>
    </Page>
  );
}
