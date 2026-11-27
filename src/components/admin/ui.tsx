// Small building blocks for the admin screens. Server-safe (no client hooks).
import Link from "next/link";

export function AdminCard({ title, children, actions, className = "" }: {
  title?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-card bg-surface p-4 shadow-card ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-[17px] font-bold text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, href, tone = "plain" }: {
  label: string;
  value: React.ReactNode;
  href?: string;
  tone?: "plain" | "warn" | "good";
}) {
  const colour = tone === "warn" ? "text-accent" : tone === "good" ? "text-[#2F7A4A]" : "text-ink";
  const body = (
    <>
      <p className="label-caps text-secondary">{label}</p>
      <p className={`mt-1 text-[28px] font-bold tabular-nums leading-none ${colour}`}>{value}</p>
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-card bg-surface p-4 shadow-card hover:ring-2 hover:ring-ink/15">
      {body}
    </Link>
  ) : (
    <div className="rounded-card bg-surface p-4 shadow-card">{body}</div>
  );
}

const pillTone = {
  live: "bg-[#DDEFE3] text-[#1F5E36]",
  draft: "bg-chip text-chip-ink",
  retired: "bg-divider-soft text-body",
  pending: "bg-chip text-chip-ink",
  approved: "bg-[#DDEFE3] text-[#1F5E36]",
  rejected: "bg-divider-soft text-secondary",
  warn: "bg-[#FBE3DE] text-[#8F2F1C]",
  info: "bg-[#E1ECF4] text-[#12324A]",
} as const;

export function Pill({ tone, children }: { tone: keyof typeof pillTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-semibold ${pillTone[tone]}`}>
      {children}
    </span>
  );
}

export const adminInput =
  "mt-1 block h-10 w-full rounded-button border border-divider bg-surface px-3 text-[15px] text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20";
export const adminTextarea =
  "mt-1 block w-full rounded-button border border-divider bg-surface px-3 py-2 text-[15px] text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20";
export const adminLabel = "block text-[13px] font-semibold text-ink";
export const adminButton =
  "inline-flex h-10 items-center justify-center rounded-button bg-ink px-4 text-[14px] font-semibold text-white disabled:opacity-50";
export const adminButtonSecondary =
  "inline-flex h-10 items-center justify-center rounded-button border border-divider bg-surface px-4 text-[14px] font-semibold text-ink hover:bg-background disabled:opacity-50";
export const adminButtonDanger =
  "inline-flex h-10 items-center justify-center rounded-button border border-accent/40 bg-surface px-4 text-[14px] font-semibold text-accent hover:bg-[#FBE3DE] disabled:opacity-50";
