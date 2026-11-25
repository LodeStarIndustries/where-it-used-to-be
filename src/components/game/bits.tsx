"use client";
// Small shared pieces for the game screens.
import { useEffect, useRef, useSyncExternalStore } from "react";
import { game, type Category, type VerdictKey } from "@config/game";
import { nextPuzzleAt, puzzleDateFor } from "@/lib/puzzle-date";

export const categoryLabel: Record<Category, string> = {
  restaurant: "Restaurant",
  bar: "Bar",
  retail: "Retail",
  grocery: "Grocery",
  entertainment: "Entertainment",
  service: "Service",
  automotive: "Automotive",
  other: "Other",
};

export const verdictLabel = (key: VerdictKey) => game.verdicts.find((v) => v.key === key)!.label;

/** Round dots on the results screen, coloured like the share squares. */
export const verdictColour: Record<VerdictKey, string> = {
  lifer: "#3E8E5A",
  knows: "#D9A815",
  closeish: "#E07B24",
  away: "#C0392B",
  who: "#12324A",
};

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-chip px-2.5 py-1 text-[12px] font-semibold text-chip-ink">
      {children}
    </span>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="label-caps inline-flex rounded-tag bg-background px-2 py-1 text-secondary">{children}</span>
  );
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// A one-second clock shared by every countdown. Null while rendering on the server.
function subscribeClock(onChange: () => void) {
  const id = setInterval(onChange, 1000);
  return () => clearInterval(id);
}
const clockNow = () => Math.floor(Date.now() / 1000) * 1000;
const noClock = () => null;

/** "5:12:03" until the next puzzle (midnight in Saint John). Calls onRollover when it starts. */
export function Countdown({ onRollover }: { onRollover?: () => void }) {
  const now = useSyncExternalStore(subscribeClock, clockNow, noClock);
  // The puzzle date by the browser's clock; when it changes, a new puzzle has started.
  const day = now === null ? null : puzzleDateFor(new Date(now));
  const seenDay = useRef<string | null>(null);
  useEffect(() => {
    if (day === null) return;
    if (seenDay.current !== null && seenDay.current !== day) onRollover?.();
    seenDay.current = day;
  }, [day, onRollover]);

  if (now === null) return <span className="tabular-nums">--:--:--</span>;
  const s = Math.max(0, Math.floor((nextPuzzleAt(new Date(now)).getTime() - now) / 1000));
  return (
    <span className="tabular-nums" role="timer" aria-live="off">
      {Math.floor(s / 3600)}:{pad(Math.floor((s % 3600) / 60))}:{pad(s % 60)}
    </span>
  );
}

/** Hard rule 7: room for an ad, off unless the config flag turns it on. */
export function AdSlot() {
  if (!game.ads.enabled) return null;
  return <div className="h-[100px] w-full rounded-card bg-surface" aria-label="Advertisement" />;
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`h-button w-full rounded-button bg-ink px-4 text-[15px] font-semibold text-white transition-opacity disabled:opacity-50 ${props.className ?? ""}`}
    />
  );
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`h-button w-full rounded-button border border-divider bg-surface px-4 text-[15px] font-semibold text-ink disabled:opacity-50 ${props.className ?? ""}`}
    />
  );
}
