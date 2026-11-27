"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { sendMagicLink, signInWithGoogle, type FormState } from "@/lib/auth/actions";
import { FormMessage, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/Page";

function Submit({ children, className }: { children: React.ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Just a moment…" : children}
    </button>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="mr-2">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export function SignInForms({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(sendMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className="mt-6 rounded-card bg-surface p-5 shadow-card" role="status">
        <h2 className="text-[18px] font-bold text-ink">Check your email</h2>
        <p className="mt-2 text-[15px] text-body">
          We sent a sign-in link to <strong className="text-ink">{state.email}</strong>. Open it on this device to finish
          signing in. It may take a minute, and it might land in your spam folder.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Submit className={secondaryButtonClass}>
          <GoogleMark />
          Continue with Google
        </Submit>
      </form>

      <div className="flex items-center gap-3 text-[13px] text-secondary" aria-hidden="true">
        <span className="h-px flex-1 bg-divider" /> or <span className="h-px flex-1 bg-divider" />
      </div>

      <form action={action} noValidate>
        <input type="hidden" name="next" value={next} />
        <label htmlFor="email" className="block text-[14px] font-semibold text-ink">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          className={inputClass}
          aria-describedby="email-help"
        />
        <p id="email-help" className="mt-1 text-[13px] text-secondary">
          We&apos;ll email you a link. No password needed.
        </p>
        <FormMessage state={state} />
        <Submit className={`${primaryButtonClass} mt-4`}>Email me a sign-in link</Submit>
      </form>
    </div>
  );
}
