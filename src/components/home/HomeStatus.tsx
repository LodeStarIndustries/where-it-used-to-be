"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Countdown } from "@/components/game/bits";
import { fetchToday } from "@/lib/game/client";
import type { TodayResponse } from "@/lib/game/types";
import hero from "@/assets/home-hero.webp";
import { pillClass } from "@/components/ui/Page";

function formatDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

/** The illustrated intro with the Play button, then the day, date, streak and countdown. */
export function HomeStatus({ account }: { account: React.ReactNode }) {
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    fetchToday()
      .then((t) => {
        setToday(t);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  const started = today?.status === "ok" && today.results.length > 0;
  const done = today?.status === "ok" && today.completed;
  const label = done ? "See today's results" : started ? "Keep playing" : "Play";

  const loading = !today && !failed;

  return (
    <>
      {/* The illustrated intro. Its title is painted in, so the page's h1 is for screen readers. */}
      <section className="relative -mx-4 aspect-[923/2000] overflow-hidden min-[431px]:mx-0 min-[431px]:rounded-sheet">
        <Image src={hero} alt="" fill priority sizes="(max-width: 430px) 100vw, 430px" placeholder="blur" className="object-cover" />
        <div className="absolute inset-x-[10%] top-[79.5%] flex flex-col gap-3">
          {today?.status === "none" ? (
            <p className="rounded-card bg-surface/95 p-4 text-center text-[15px] text-body shadow-card">
              Today&apos;s puzzle isn&apos;t ready yet. Check back soon.
            </p>
          ) : (
            <Link
              href="/play"
              aria-disabled={!today}
              className={`flex h-16 items-center justify-center gap-2 rounded-full border-[3px] border-ink bg-accent text-[22px] font-bold text-white shadow-[0_4px_0_#12324A] transition-transform active:translate-y-0.5 ${
                today ? "" : "pointer-events-none opacity-70"
              }`}
            >
              {loading ? "Loading…" : label}
              {!loading && (
                <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true">
                  <path d="M2 1.5v15L15 9z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              )}
            </Link>
          )}
          <div className="flex justify-center gap-2">
            <Link href="/how-to-play" className={pillClass}>
              How to play
            </Link>
            {account}
          </div>
        </div>
      </section>

      <div className="mt-6 rounded-card bg-surface p-5 shadow-card">
        <p className="label-caps text-secondary">{today ? `Day #${today.number}` : " "}</p>
        <p className="mt-1 text-[20px] font-bold text-ink">{today ? formatDate(today.date) : " "}</p>
        <p className="mt-1 text-[15px] text-body">
          Five rounds about Saint John businesses that are gone. Everyone gets the same puzzle.
        </p>
        {failed && (
          <p className="mt-3 text-[14px] text-accent" role="alert">
            Couldn&apos;t reach the game. Check your connection.{" "}
            <button type="button" className="underline" onClick={load}>
              Try again
            </button>
          </p>
        )}

        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-divider-soft pt-4">
          <div>
            <dt className="label-caps text-secondary">Streak</dt>
            <dd className="mt-1 text-[18px] font-bold text-ink">
              {today ? `${today.streak} ${today.streak === 1 ? "day" : "days"}` : " "}
            </dd>
          </div>
          <div>
            <dt className="label-caps text-secondary">Next puzzle</dt>
            <dd className="mt-1 text-[18px] font-bold text-ink">
              <Countdown onRollover={load} />
            </dd>
          </div>
        </dl>
      </div>
    </>
  );
}
