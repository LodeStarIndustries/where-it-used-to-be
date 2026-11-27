"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import { saveWelcome, type FormState } from "@/lib/auth/actions";
import { FormMessage, inputClass, primaryButtonClass } from "@/components/ui/Page";

function Submit({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending} className={`${primaryButtonClass} mt-6`}>
      {pending ? "Saving…" : "Continue"}
    </button>
  );
}

export function WelcomeForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveWelcome, { status: "idle" });
  return (
    <form
      // onSubmit (not the action prop) keeps the typed name if it's taken.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="mt-6"
      noValidate
    >
      <input type="hidden" name="next" value={next} />
      <label htmlFor="displayName" className="block text-[14px] font-semibold text-ink">
        Display name
      </label>
      <input
        id="displayName"
        name="displayName"
        required
        minLength={2}
        maxLength={24}
        autoComplete="nickname"
        className={inputClass}
        aria-describedby="name-help"
      />
      <p id="name-help" className="mt-1 text-[13px] text-secondary">
        2 to 24 characters. Everyone can see it on the leaderboard, so don&apos;t use your full name.
      </p>
      <FormMessage state={state} />

      <div className="mt-6 flex items-start gap-3">
        <input
          id="marketingOptIn"
          name="marketingOptIn"
          type="checkbox"
          className="mt-0.5 size-5 shrink-0 accent-ink"
          aria-describedby="optin-help"
        />
        <div>
          <label htmlFor="marketingOptIn" className="text-[15px] text-ink">
            Email me now and then about Where It Used To Be
          </label>
          <p id="optin-help" className="mt-1 text-[13px] text-secondary">
            Optional. News about the game and new features. You can change this any time in your profile. See our{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              privacy notes
            </Link>
            .
          </p>
        </div>
      </div>

      <Submit pending={pending} />
    </form>
  );
}
