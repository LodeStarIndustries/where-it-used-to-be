"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/auth/actions";
import { createGroupAction, renameGroupAction } from "@/lib/account/group-actions";
import { FormMessage, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/Page";

const idle: FormState = { status: "idle" };

export function Submit({ children, pendingText = "Saving…", className = primaryButtonClass }: {
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

export function CreateGroupForm() {
  const [state, action] = useActionState(createGroupAction, idle);
  return (
    <form action={action} noValidate>
      <label htmlFor="name" className="block text-[14px] font-semibold text-ink">
        Group name
      </label>
      <input id="name" name="name" required maxLength={40} className={inputClass} placeholder="Family, Work, Book club…" />
      <FormMessage state={state} />
      <div className="mt-3">
        <Submit pendingText="Creating…">Create group</Submit>
      </div>
    </form>
  );
}

export function RenameGroupForm({ groupId, name }: { groupId: string; name: string }) {
  const [state, action] = useActionState(renameGroupAction, idle);
  return (
    <form action={action} noValidate>
      <input type="hidden" name="groupId" value={groupId} />
      <label htmlFor="name" className="block text-[14px] font-semibold text-ink">
        Group name
      </label>
      <input id="name" name="name" defaultValue={name} required maxLength={40} className={inputClass} />
      <FormMessage state={state} />
      <div className="mt-3">
        <Submit className={secondaryButtonClass}>Rename</Submit>
      </div>
    </form>
  );
}

/** Shares the invite link with the phone's share sheet, or copies it. */
export function InviteLink({ url, groupName }: { url: string; groupName: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const data = { title: "Where It Used To Be", text: `Join my group "${groupName}" on Where It Used To Be`, url };
    try {
      if (navigator.share && navigator.canShare?.(data)) {
        await navigator.share(data);
        return;
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this invite link:", url);
    }
  }
  return (
    <div>
      <p className="break-all rounded-button bg-background px-3 py-2 font-mono text-[13px] text-body">{url}</p>
      <button type="button" onClick={share} className={`${primaryButtonClass} mt-3`}>
        {copied ? "Copied" : "Share invite link"}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Invite link copied" : ""}
      </span>
    </div>
  );
}

/** A button that asks before submitting its form. */
export function ConfirmSubmit({ children, question, className }: { children: React.ReactNode; question: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (!window.confirm(question)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
