import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { livePool, placeNames, puzzlesBetween } from "@/lib/admin/data";
import { requireAdminPage } from "@/lib/admin/guard";
import { formatShortDate } from "@/lib/format";
import { puzzleDateFor, puzzleNumberFor } from "@/lib/puzzle-date";
import { DayEditor } from "@/components/admin/DayEditor";
import { GenerateButton } from "@/components/admin/GenerateButton";
import { AdminCard, adminButtonSecondary } from "@/components/admin/ui";

async function Day({ params }: { params: PageProps<"/admin/puzzles/[date]">["params"] }) {
  const { date } = await params;
  await requireAdminPage(`/admin/puzzles/${date}`);
  if (!z.iso.date().safeParse(date).success) notFound();
  await connection();
  const today = puzzleDateFor(new Date());
  const [[day], pool] = await Promise.all([puzzlesBetween(date, date), livePool()]);
  const names = day
    ? await placeNames(day.rounds.flatMap((r) => [r.place_id, ...(r.wrong_place_ids ?? [])]))
    : new Map();
  const started = date <= today || Boolean(day?.locked);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[26px] font-bold text-ink">
          {formatShortDate(date)} <span className="font-normal text-secondary">· Day #{puzzleNumberFor(date)}</span>
        </h1>
        {day && (
          <Link href={`/admin/puzzles/${date}/preview`} className={adminButtonSecondary}>
            Preview as player
          </Link>
        )}
      </div>

      {!day ? (
        <AdminCard>
          <p className="mb-3 text-[14px] text-body">No puzzle for this day yet.</p>
          {date >= today && <GenerateButton missing={1} />}
        </AdminCard>
      ) : started ? (
        <AdminCard title={date === today ? "Today's puzzle (it has started, so it can't change)" : "Already played (it can't change)"}>
          <ol className="space-y-1 text-[14px] text-body">
            {day.rounds.map((r, i) => (
              <li key={i}>
                <span className="inline-block w-24 text-secondary">
                  {i + 1}. {r.mode === "pin" ? "Pin it" : "Name it"}
                </span>
                {names.get(r.place_id)?.name}
                {r.wrong_place_ids && (
                  <span className="text-secondary">
                    {" "}
                    (wrong: {r.wrong_place_ids.map((id) => names.get(id)?.name).join(", ")})
                  </span>
                )}
              </li>
            ))}
          </ol>
        </AdminCard>
      ) : (
        <DayEditor
          date={date}
          rounds={day.rounds}
          pool={pool.map((p) => ({ id: p.id, siteId: p.siteId, name: p.name, difficulty: p.difficulty, lastUsedOn: p.lastUsedOn }))}
          names={Object.fromEntries([...names].map(([id, v]) => [id, v.name]))}
        />
      )}
    </div>
  );
}

export default function DayPage(props: PageProps<"/admin/puzzles/[date]">) {
  return (
    <div>
      <Link href="/admin/puzzles" className="text-[14px] font-semibold text-ink hover:underline">
        ← Puzzles
      </Link>
      <div className="mt-3">
        <Suspense fallback={<p className="label-caps text-secondary">Loading…</p>}>
          <Day params={props.params} />
        </Suspense>
      </div>
    </div>
  );
}
