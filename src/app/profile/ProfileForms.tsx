"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteMyAccount,
  signOut,
  updateDisplayName,
  updateMarketingOptIn,
  type FormState,
} from "@/lib/auth/actions";
import { resetDeviceId } from "@/lib/game/client";
import { FormMessage, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/Page";

const idle: FormState = { status: "idle" };

function Submit({ children, pendingText = "Saving…", className = primaryButtonClass }: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}

export function DisplayNameForm({ current }: { current: string }) {
  const [state, action] = useActionState(updateDisplayName, idle);
  return (
    <form action={action} noValidate>
      <label htmlFor="displayName" className="block text-[14px] font-semibold text-ink">
        Display name
      </label>
      <input
        id="displayName"
        name="displayName"
        defaultValue={current}
        required
        minLength={2}
        maxLength={24}
        autoComplete="nickname"
        className={inputClass}
      />
      <FormMessage state={state} />
      <div className="mt-3">
        <Submit className={secondaryButtonClass}>Save name</Submit>
      </div>
    </form>
  );
}

export function MarketingForm({ optedIn }: { optedIn: boolean }) {
  const [state, action] = useActionState(updateMarketingOptIn, idle);
  return (
    <form action={action}>
      <div className="flex items-start gap-3">
        <input
          id="marketingOptIn"
          name="marketingOptIn"
          type="checkbox"
          defaultChecked={optedIn}
          className="mt-0.5 size-5 shrink-0 accent-ink"
        />
        <label htmlFor="marketingOptIn" className="text-[15px] text-ink">
          Email me now and then about Where It Used To Be
        </label>
      </div>
      <FormMessage state={state} />
      <div className="mt-3">
        <Submit className={secondaryButtonClass}>Save email choice</Submit>
      </div>
    </form>
  );
}

/** Signing out also gives this browser a fresh guest ID, so the next guest starts clean. */
export function SignOutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={secondaryButtonClass}
      onClick={() =>
        start(async () => {
          await signOut();
          resetDeviceId();
          router.push("/");
          router.refresh();
        })
      }
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

export function DeleteAccountForm() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteMyAccount, idle);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[15px] font-semibold text-accent underline underline-offset-2">
        Delete account
      </button>
    );
  }
  return (
    <form action={action} className="rounded-card border border-accent/40 p-4" noValidate>
      <p className="text-[15px] text-body">
        This permanently deletes your profile, every result you&apos;ve played while signed in, your group memberships and
        any groups you own. It can&apos;t be undone.
      </p>
      <label htmlFor="confirm" className="mt-4 block text-[14px] font-semibold text-ink">
        Type DELETE to confirm
      </label>
      <input id="confirm" name="confirm" autoComplete="off" autoCapitalize="characters" className={inputClass} />
      <FormMessage state={state} />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setOpen(false)} className={secondaryButtonClass}>
          Cancel
        </button>
        <Submit pendingText="Deleting…" className={`${primaryButtonClass} bg-accent`}>
          Delete
        </Submit>
      </div>
    </form>
  );
}
