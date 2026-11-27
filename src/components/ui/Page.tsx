import Link from "next/link";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-[14px] font-semibold text-ink underline-offset-2 hover:underline">
      ← {label}
    </Link>
  );
}

/** The frame for simple pages: a back link, a title and the content. */
export function Page(props: { title: string; back?: { href: string; label: string }; children: React.ReactNode }) {
  const back = props.back ?? { href: "/", label: "Home" };
  return (
    <main className="mx-auto w-full max-w-[430px] px-4 pb-12 pt-6">
      <BackLink {...back} />
      <h1 className="mt-4 text-[28px] font-bold leading-tight text-ink">{props.title}</h1>
      {props.children}
    </main>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-card bg-surface p-4 shadow-card ${className}`}>{children}</section>;
}

export function Loading() {
  return (
    <p className="label-caps mt-6 text-secondary" aria-live="polite">
      Loading…
    </p>
  );
}

/** Form message: errors in the accent colour, confirmations in the body colour. */
export function FormMessage({ state }: { state: { status: string; message?: string } }) {
  if (!state.message) return null;
  return (
    <p className={`mt-2 text-[14px] ${state.status === "error" ? "text-accent" : "text-body"}`} role={state.status === "error" ? "alert" : "status"}>
      {state.message}
    </p>
  );
}

export const inputClass =
  "mt-1 block h-button w-full rounded-button border border-divider bg-surface px-4 text-[16px] text-ink placeholder:text-secondary focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20";

export const primaryButtonClass =
  "flex h-button w-full items-center justify-center rounded-button bg-ink px-4 text-[15px] font-semibold text-white transition-opacity disabled:opacity-50";

export const secondaryButtonClass =
  "flex h-button w-full items-center justify-center rounded-button border border-divider bg-surface px-4 text-[15px] font-semibold text-ink disabled:opacity-50";

/** The small white buttons under Play on the home screen. */
export const pillClass =
  "flex h-11 min-w-0 items-center justify-center rounded-full border-2 border-ink bg-surface px-5 text-[15px] font-semibold text-ink shadow-card";
