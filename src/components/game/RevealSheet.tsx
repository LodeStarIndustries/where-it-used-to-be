"use client";

import { forwardRef } from "react";
import { EraCard } from "@/components/era-card/EraCard";
import { formatDistance } from "@/lib/game/scoring";
import type { RoundResult } from "@/lib/game/types";
import { Chip, PrimaryButton, verdictLabel } from "./bits";

export interface RevealSheetProps {
  result: RoundResult;
  totalPoints: number;
  isLast: boolean;
  onNext: () => void;
}

/** The bottom sheet after a guess: era card, verdict, points, fact and Next. */
export const RevealSheet = forwardRef<HTMLDivElement, RevealSheetProps>(function RevealSheet(
  { result, totalPoints, isLast, onNext },
  ref,
) {
  const { answer } = result;
  return (
    <section
      ref={ref}
      aria-labelledby="reveal-heading"
      className="wiutb-sheet pointer-events-auto max-h-[72dvh] overflow-y-auto rounded-t-sheet bg-surface px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 shadow-sheet"
    >
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-divider" aria-hidden="true" />
      <h2 id="reveal-heading" className="sr-only">
        Round {result.index + 1} answer: {answer.name}
      </h2>

      <EraCard
        name={answer.name}
        era={answer.era}
        yearClosed={answer.yearClosed}
        currentUse={answer.currentUse}
        street={answer.street}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Chip>{verdictLabel(result.verdict)}</Chip>
        <span className="text-[14px] font-medium text-body">
          {result.mode === "pin" ? `${formatDistance(result.distanceM ?? 0)} away` : result.correct ? "Right" : "Wrong"}
        </span>
      </div>

      <div className="mt-3 flex items-baseline justify-between border-y border-divider-soft py-3">
        <p className="text-[15px] text-body">
          <span className="text-[22px] font-bold text-ink">+{result.points}</span> points
        </p>
        <p className="text-[14px] text-secondary">
          Total <span className="font-semibold text-ink">{totalPoints}</span>
        </p>
      </div>

      {answer.fact && <p className="mt-3 text-[15px] leading-relaxed text-body">{answer.fact}</p>}
      {answer.sources.length > 0 && (
        <details className="mt-2 text-[13px] text-secondary">
          <summary className="cursor-pointer font-medium underline underline-offset-2">Sources</summary>
          <ul className="mt-1.5 space-y-1">
            {answer.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}

      <PrimaryButton className="mt-4" onClick={onNext} autoFocus>
        {isLast ? "See results" : "Next round"}
      </PrimaryButton>
    </section>
  );
});
