"use client";

import Link from "next/link";
import { useState } from "react";
import { game, maxPointsPerDay } from "@config/game";
import { EraCard } from "@/components/era-card/EraCard";
import { shareText } from "@/lib/game/scoring";
import type { RoundResult } from "@/lib/game/types";
import { AdSlot, Countdown, PrimaryButton, SecondaryButton, verdictColour, verdictLabel } from "./bits";

export interface ResultsProps {
  number: number;
  results: RoundResult[];
  totalPoints: number;
  streak: number;
  signedIn: boolean;
  /** Rank on today's public board (signed-in players with a display name). */
  rank: number | null;
}

export function Results({ number, results, totalPoints, streak, signedIn, rank }: ResultsProps) {
  const [shared, setShared] = useState<"idle" | "copied" | "failed">("idle");
  const [saving, setSaving] = useState<"idle" | "busy" | "saved" | "failed">("idle");

  /** The results card as a PNG: the share sheet on phones (Save Image), a download elsewhere. */
  async function saveImage() {
    setSaving("busy");
    const fileName = `where-it-used-to-be-${number}.png`;
    try {
      const res = await fetch(`/share-image?n=${number}&p=${results.map((r) => r.points).join(",")}`);
      if (!res.ok) throw new Error(String(res.status));
      const file = new File([await res.blob()], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          setSaving("idle");
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") {
            setSaving("idle");
            return;
          }
          // Fall through to a download.
        }
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setSaving("saved");
    } catch {
      setSaving("failed");
    }
  }

  async function share() {
    const text = shareText(
      number,
      results.map((r) => r.points),
      window.location.origin,
    );
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShared("copied");
    } catch (e) {
      // The player closing the share sheet isn't an error.
      if (e instanceof DOMException && e.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(text);
        setShared("copied");
      } catch {
        setShared("failed");
      }
    }
  }

  return (
    <main className="mx-auto w-full max-w-[430px] px-4 pb-12 pt-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-[14px] font-semibold text-ink underline-offset-2 hover:underline">
          ← Home
        </Link>
        <p className="label-caps text-secondary">Day #{number}</p>
      </div>

      <section aria-labelledby="score-heading" className="mt-4 rounded-card bg-surface p-5 shadow-card">
        <h1 id="score-heading" className="label-caps text-secondary">
          Today&apos;s score
        </h1>
        <p className="mt-2 text-ink">
          <span className="text-score font-bold">{totalPoints}</span>
          <span className="text-[18px] font-semibold text-secondary">/{maxPointsPerDay.toLocaleString("en-CA")}</span>
        </p>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-background"
          role="progressbar"
          aria-label="Score"
          aria-valuemin={0}
          aria-valuemax={maxPointsPerDay}
          aria-valuenow={totalPoints}
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${(totalPoints / maxPointsPerDay) * 100}%` }} />
        </div>

        <ol className="mt-4 flex gap-2" aria-label="Rounds">
          {results.map((r) => (
            <li key={r.index} className="flex flex-1 flex-col items-center gap-1">
              <span className="block h-3.5 w-3.5 rounded-full" style={{ background: verdictColour[r.verdict] }} aria-hidden="true" />
              <span className="sr-only">
                Round {r.index + 1}: {r.points} points, {verdictLabel(r.verdict)}
              </span>
              <span className="text-[12px] font-semibold tabular-nums text-secondary" aria-hidden="true">
                {r.points}
              </span>
            </li>
          ))}
        </ol>

        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-divider-soft pt-4">
          <div>
            <dt className="label-caps text-secondary">Streak</dt>
            <dd className="mt-1 text-[20px] font-bold text-ink">
              {streak} {streak === 1 ? "day" : "days"}
            </dd>
          </div>
          <div>
            <dt className="label-caps text-secondary">Next puzzle</dt>
            <dd className="mt-1 text-[20px] font-bold text-ink">
              <Countdown />
            </dd>
          </div>
        </dl>

        <PrimaryButton className="mt-5" onClick={share}>
          Share
        </PrimaryButton>
        <SecondaryButton className="mt-2" onClick={saveImage} disabled={saving === "busy"}>
          {saving === "busy" ? "Making the image…" : "Save image"}
        </SecondaryButton>
        <p className="mt-2 min-h-5 text-center text-[13px] text-secondary" aria-live="polite">
          {shared === "copied"
            ? "Copied. Paste it anywhere."
            : shared === "failed"
              ? "Couldn't copy. Try again."
              : saving === "saved"
                ? "Image saved to your downloads."
                : saving === "failed"
                  ? "Couldn't make the image. Try again."
                  : ""}
        </p>
      </section>

      <section className="mt-4 rounded-card bg-surface p-4 shadow-card">
        {signedIn ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[15px] text-body">
              {rank ? (
                <>
                  You&apos;re <strong className="text-ink">#{rank}</strong> today.
                </>
              ) : (
                "You're on today's leaderboard."
              )}
            </p>
            <Link href="/leaderboard" className="shrink-0 text-[14px] font-semibold text-ink underline underline-offset-2">
              Leaderboard
            </Link>
          </div>
        ) : (
          <p className="text-[14px] text-body">
            <Link href="/sign-in?next=/play" className="font-semibold text-ink underline underline-offset-2">
              Sign in
            </Link>{" "}
            to appear on the leaderboard and keep your streak on every device. Today&apos;s score comes with you.
          </p>
        )}
      </section>

      <div className="mt-4">
        <AdSlot />
      </div>

      <section aria-labelledby="recap-heading" className="mt-6">
        <h2 id="recap-heading" className="label-caps text-secondary">
          Today&apos;s places
        </h2>
        <ol className="mt-3 space-y-4">
          {results.map((r) => (
            <li key={r.index}>
              <EraCard mini name={r.answer.name} era={r.answer.era} />
              {r.answer.fact && <p className="mt-2 px-1 text-[14px] leading-relaxed text-body">{r.answer.fact}</p>}
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-8 text-center text-[12px] text-secondary">
        {game.roundsPerDay} rounds, up to {game.maxPointsPerRound} points each.
      </p>
    </main>
  );
}
