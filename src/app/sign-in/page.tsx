import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { currentUserId, safeNext } from "@/lib/auth/session";
import { Loading, Page } from "@/components/ui/Page";
import { SignInForms } from "./SignInForms";

export const metadata: Metadata = { title: "Sign in · Where It Used To Be" };

const errors: Record<string, string> = {
  link: "That sign-in link didn't work. It may have expired or already been used. Try again.",
  cancelled: "Sign-in was cancelled.",
  google: "Couldn't start Google sign-in. Try again, or use your email.",
};

async function SignIn({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await currentUserId()) redirect(next);
  const error = typeof params.error === "string" ? errors[params.error] : undefined;
  return (
    <>
      {error && (
        <p className="mt-4 rounded-card bg-chip p-3 text-[14px] text-chip-ink" role="alert">
          {error}
        </p>
      )}
      <SignInForms next={next} />
    </>
  );
}

export default function SignInPage(props: PageProps<"/sign-in">) {
  return (
    <Page title="Sign in">
      <p className="mt-2 text-[15px] text-body">
        Playing never needs an account. Sign in to appear on the leaderboard, join groups with friends and keep your
        streak across devices. Anything you&apos;ve played on this device comes with you.
      </p>
      <Suspense fallback={<Loading />}>
        <SignIn searchParams={props.searchParams} />
      </Suspense>
      <p className="mt-8 text-[13px] text-secondary">
        See our{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          privacy notes
        </Link>{" "}
        for what we keep.
      </p>
    </Page>
  );
}
