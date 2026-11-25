"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Countdown } from "@/components/game/bits";
import { fetchToday } from "@/lib/game/client";
import type { TodayResponse } from "@/lib/game/types";

function formatDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

/** Day number, date, the Play button and streak, for this device. */
export function HomeStatus() {
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

  return (
    <>
      <div className="mt-8 rounded-card bg-surface p-5 shadow-card">
        <p className="label-caps text-secondary">{today ? `Day #${today.number}` : " "}</p>
        <p className="mt-1 text-[20px] font-bold text-ink">{today ? formatDate(today.date) : " "}</p>

        {today?.status === "none" ? (
          <p className="mt-4 text-[15px] text-body">Today&apos;s puzzle isn&apos;t ready yet. Check back soon.</p>
        ) : (
          <Link
            href="/play"
            aria-disabled={!today}
            className={`mt-5 flex h-button items-center justify-center rounded-button bg-ink text-[15px] font-semibold text-white ${
              today ? "" : "pointer-events-none opacity-50"
            }`}
          >
            {label}
          </Link>
        )}
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
              {today ? `${today.streak} ${today.streak === 1 ? "day" : "days"}` : " "}
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
