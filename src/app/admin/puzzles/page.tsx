import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { game } from "@config/game";
import { livePool, placeNames, puzzlesBetween } from "@/lib/admin/data";
import { requireAdminPage } from "@/lib/admin/guard";
import { formatShortDate } from "@/lib/format";
import { addDays, puzzleDateFor, puzzleNumberFor } from "@/lib/puzzle-date";
import { GenerateButton } from "@/components/admin/GenerateButton";
import { AdminCard, Pill } from "@/components/admin/ui";

async function Calendar() {
  await requireAdminPage("/admin/puzzles");
  await connection();
  const today = puzzleDateFor(new Date());
  const from = addDays(today, -3);
  const to = addDays(today, game.scheduling.daysAhead - 1);
  const [days, pool] = await Promise.all([puzzlesBetween(from, to), livePool()]);
  const names = await placeNames(days.flatMap((d) => d.rounds.map((r) => r.place_id)));
  const byDate = new Map(days.map((d) => [d.date, d]));
  // Days before the first puzzle (Day #1) don't exist.
  const dates = Array.from({ length: game.scheduling.daysAhead + 3 }, (_, i) => addDays(from, i)).filter(
    (d) => puzzleNumberFor(d) >= 1,
  );
  const missing = dates.filter((d) => d >= today && !byDate.has(d)).length;
  const neverUsed = pool.filter((p) => p.lastUsedOn === null).length;

  return (
    <div className="space-y-4">
      <h1 className="text-[26px] font-bold text-ink">Puzzles</h1>
      <AdminCard>
        <p className="text-[14px] text-body">
          {pool.length} live places · {neverUsed} never used ({Math.floor(neverUsed / game.roundsPerDay)} days&apos; worth). Generate
          fills every missing day from today to {formatShortDate(to)}, least recently used places first, and never changes
          a day that already has a puzzle.
        </p>
        <p className="mt-2 text-[14px] text-body">
          There&apos;s nothing to publish: each scheduled day goes live on its own at midnight, Moncton time. Days that
          have started can&apos;t be changed.
        </p>
        <div className="mt-3">
          <GenerateButton missing={missing} />
        </div>
      </AdminCard>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dates.map((date) => {
          const day = byDate.get(date);
          const started = date <= today;
          return (
            <li key={date} className="min-w-0">
              <Link
                href={`/admin/puzzles/${date}`}
                className={`block h-full rounded-card bg-surface p-3 shadow-card hover:ring-2 hover:ring-ink/15 ${date === today ? "ring-2 ring-ink" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[15px] font-bold text-ink">
                    {formatShortDate(date)} <span className="font-normal text-secondary">· Day #{puzzleNumberFor(date)}</span>
                  </p>
                  {!day ? (
                    <Pill tone="warn">Missing</Pill>
                  ) : date === today ? (
                    <Pill tone="info">Today</Pill>
                  ) : started ? (
                    <Pill tone="retired">Played</Pill>
                  ) : (
                    <Pill tone="live">Scheduled</Pill>
                  )}
                </div>
                {day && (
                  <ol className="mt-2 space-y-0.5 text-[13px] text-body">
                    {day.rounds.map((r, i) => (
                      <li key={i} className="truncate">
                        <span className="inline-block w-10 text-secondary">{r.mode === "pin" ? "Pin" : "Name"}</span>
                        {names.get(r.place_id)?.name ?? "Missing place"}
                      </li>
                    ))}
                  </ol>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function PuzzlesPage() {
  return (
    <Suspense fallback={<p className="label-caps text-secondary">Loading…</p>}>
      <Calendar />
    </Suspense>
  );
}
