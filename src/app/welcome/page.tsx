import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getProfile } from "@/lib/account/data";
import { currentUserId, safeNext } from "@/lib/auth/session";
import { Loading } from "@/components/ui/Page";
import { WelcomeForm } from "./WelcomeForm";

export const metadata: Metadata = { title: "Welcome · Where It Used To Be" };

async function Welcome({ searchParams }: { searchParams: PageProps<"/welcome">["searchParams"] }) {
  const next = safeNext((await searchParams).next);
  const userId = await currentUserId();
  if (!userId) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  const profile = await getProfile(userId);
  if (profile?.displayName) redirect(next);
  return <WelcomeForm next={next} />;
}

export default function WelcomePage(props: PageProps<"/welcome">) {
  return (
    <main className="mx-auto w-full max-w-[430px] px-4 pb-12 pt-10">
      <h1 className="text-[28px] font-bold leading-tight text-ink">Welcome</h1>
      <p className="mt-2 text-[15px] text-body">Pick the name other players will see.</p>
      <Suspense fallback={<Loading />}>
        <Welcome searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
