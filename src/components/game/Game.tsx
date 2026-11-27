"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { game } from "@config/game";
import { fetchToday, sendGuess } from "@/lib/game/client";
import type { LatLng } from "@/lib/game/geo";
import type { NameRound, PinRound, RoundResult, TodayResponse } from "@/lib/game/types";
import { categoryLabel, PrimaryButton, SecondaryButton, Tag } from "./bits";
import { GameMap } from "./GameMap";
import { Results } from "./Results";
import { RevealSheet } from "./RevealSheet";

type Today = Extract<TodayResponse, { status: "ok" }>;

/** Space a bottom element takes up, so the map can keep its points above it. */
function useHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  });
  return [ref, height] as const;
}

export function Game() {
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** The round on screen; equals results.length while guessing, results.length - 1 while revealing. */
  const [revealing, setRevealing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [pin, setPin] = useState<LatLng | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [guessError, setGuessError] = useState<string | null>(null);
  const [bottomRef, bottomHeight] = useHeight<HTMLDivElement>();

  const fetchAndShow = useCallback(
    () =>
      fetchToday()
        .then((t) => {
          setLoadError(null);
          setToday(t);
          setRevealing(false);
          setPin(null);
          setShowResults(t.status === "ok" && t.completed);
        })
        .catch(() => setLoadError("Couldn't load today's puzzle. Check your connection and try again.")),
    [],
  );

  // Fetch on mount; state changes only after the request resolves.
  useEffect(() => {
    fetchAndShow();
  }, [fetchAndShow]);

  const load = useCallback(() => {
    setLoadError(null);
    setToday(null);
    return fetchAndShow();
  }, [fetchAndShow]);

  const ok = today?.status === "ok" ? (today as Today) : null;
  const index = ok ? (revealing ? ok.results.length - 1 : ok.results.length) : 0;
  const round = ok && index < ok.rounds.length ? ok.rounds[index] : null;
  const lastResult: RoundResult | null = revealing && ok ? ok.results[ok.results.length - 1] : null;

  async function submit(choiceId?: string) {
    if (!ok || !round || submitting) return;
    setSubmitting(true);
    setGuessError(null);
    try {
      const res = await sendGuess(
        round.mode === "pin"
          ? { puzzleDate: ok.date, roundIndex: index, lat: pin!.lat, lng: pin!.lng }
          : { puzzleDate: ok.date, roundIndex: index, choiceId },
      );
      if (res.status === "ok") {
        setToday({
          ...ok,
          results: [...ok.results, res.result],
          totalPoints: res.totalPoints,
          completed: res.completed,
          streak: res.streak,
          rank: res.rank,
        });
        setRevealing(true);
      } else if (res.code === "already_played" || res.code === "out_of_order" || res.code === "wrong_day") {
        await load();
        setGuessError(res.message);
      } else {
        setGuessError(res.message);
      }
    } catch {
      setGuessError("Couldn't send your guess. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    setRevealing(false);
    setPin(null);
    if (ok?.completed) setShowResults(true);
  }

  // Stable map inputs, so the camera only moves when the round changes.
  const site = useMemo(() => {
    if (lastResult) return lastResult.answer.site;
    if (round?.mode === "name") return round.site;
    return null;
  }, [lastResult, round]);
  const guess = lastResult?.guess ?? null;

  if (loadError) {
    return (
      <Centered>
        <p className="text-[15px] text-body">{loadError}</p>
        <PrimaryButton className="mt-4" onClick={load}>
          Try again
        </PrimaryButton>
      </Centered>
    );
  }
  if (!today) {
    return (
      <Centered>
        <p className="label-caps text-secondary" aria-live="polite">
          Loading today&apos;s puzzle…
        </p>
      </Centered>
    );
  }
  if (today.status === "none") {
    return (
      <Centered>
        <h1 className="text-[22px] font-bold text-ink">No puzzle today</h1>
        <p className="mt-2 text-[15px] text-body">
          Today&apos;s puzzle isn&apos;t ready yet. We&apos;ve let the team know. Check back soon.
        </p>
        <Link href="/" className="mt-6 block text-[15px] font-semibold text-ink underline underline-offset-2">
          Back home
        </Link>
      </Centered>
    );
  }
  if (showResults && ok) {
    return (
      <Results
        number={ok.number}
        results={ok.results}
        totalPoints={ok.totalPoints}
        streak={ok.streak}
        signedIn={ok.signedIn}
        rank={ok.rank}
      />
    );
  }
  if (!ok) return null;

  const mapMode = revealing ? "reveal" : round?.mode === "name" ? "name" : "pin";

  return (
    <main className="fixed inset-0 overflow-hidden bg-background">
      <h1 className="sr-only">
        Where It Used To Be, day {ok.number}, round {index + 1} of {game.roundsPerDay}
      </h1>
      <GameMap
        mode={mapMode}
        pin={pin}
        onPin={setPin}
        site={site}
        guess={guess}
        bottomInset={bottomHeight}
        viewKey={`${index}:${mapMode}`}
      />

      {/* Top: day, round and running score. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-[max(12px,env(safe-area-inset-top))]">
        <div className="flex gap-2">
          <Link
            href="/"
            className="pointer-events-auto rounded-card bg-surface px-3 py-2 shadow-card"
            aria-label={`Day ${ok.number}. Back home`}
          >
            <span className="label-caps block text-secondary">Day</span>
            <span className="block text-[15px] font-bold leading-tight text-ink">#{ok.number}</span>
          </Link>
          <div className="rounded-card bg-surface px-3 py-2 shadow-card">
            <span className="label-caps block text-secondary">Round</span>
            <span className="block text-[15px] font-bold leading-tight text-ink">
              {index + 1}/{game.roundsPerDay}
            </span>
          </div>
        </div>
        <div className="rounded-card bg-surface px-3 py-2 text-right shadow-card">
          <span className="label-caps block text-secondary">Score</span>
          <span className="block text-[15px] font-bold leading-tight tabular-nums text-ink">{ok.totalPoints}</span>
        </div>
      </div>

      {/* Bottom: the round prompt, or the reveal sheet. */}
      <div ref={bottomRef} className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto max-w-[480px]">
        {revealing && lastResult ? (
          <RevealSheet
            result={lastResult}
            totalPoints={ok.totalPoints}
            isLast={lastResult.index === game.roundsPerDay - 1}
            onNext={next}
          />
        ) : round ? (
          <div className="p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <div className="pointer-events-auto rounded-card bg-surface p-4 shadow-card">
              {round.mode === "pin" ? (
                <PinPrompt round={round} pin={pin} submitting={submitting} onClear={() => setPin(null)} onLock={() => submit()} />
              ) : (
                <NamePrompt round={round} submitting={submitting} onChoose={(id) => submit(id)} />
              )}
              {guessError && (
                <p className="mt-3 text-[14px] text-accent" role="alert">
                  {guessError}
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function PinPrompt(props: {
  round: PinRound;
  pin: LatLng | null;
  submitting: boolean;
  onClear: () => void;
  onLock: () => void;
}) {
  const { round, pin, submitting, onClear, onLock } = props;
  return (
    <>
      <Tag>{categoryLabel[round.category]}</Tag>
      <h2 className="mt-2 text-[20px] font-bold leading-snug text-ink">{round.name}</h2>
      <p className="mt-1 text-[15px] text-body">Pin where it used to be.</p>
      {pin ? (
        <div className="mt-4 grid grid-cols-[1fr_2fr] gap-2">
          <SecondaryButton onClick={onClear} disabled={submitting}>
            Clear
          </SecondaryButton>
          <PrimaryButton onClick={onLock} disabled={submitting}>
            {submitting ? "Checking…" : "Lock it in"}
          </PrimaryButton>
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-secondary">Tap the map to drop your pin. You can drag it after.</p>
      )}
    </>
  );
}

function NamePrompt(props: { round: NameRound; submitting: boolean; onChoose: (id: string) => void }) {
  const { round, submitting, onChoose } = props;
  return (
    <fieldset disabled={submitting}>
      <legend className="contents">
        <span className="block text-[14px] text-secondary">
          <span className="font-semibold text-ink">Now:</span> {round.currentUse ?? "Not recorded"}
        </span>
        <span className="mt-1 block text-[20px] font-bold leading-snug text-ink">What used to be here?</span>
      </legend>
      <div className="mt-3 grid gap-2">
        {round.choices.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChoose(c.id)}
            className="min-h-button rounded-button border border-divider bg-surface px-4 py-2 text-left text-[15px] font-semibold text-ink transition-colors hover:bg-background disabled:opacity-50"
          >
            {c.name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center px-6 text-center">{children}</main>;
}
