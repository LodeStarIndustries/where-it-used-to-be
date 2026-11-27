import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { requireAdminPage } from "@/lib/admin/guard";
import { formatShortDate } from "@/lib/format";
import { streetFromAddress } from "@/lib/game/geo";
import { gameStore } from "@/lib/game/server";
import { toPlayableRounds } from "@/lib/game/service";
import { EraCard } from "@/components/era-card/EraCard";
import { categoryLabel } from "@/components/game/labels";
import { AdminCard } from "@/components/admin/ui";

// What a player sees for each round (built by the same code the game uses), then the reveal.
async function Preview({ params }: { params: PageProps<"/admin/puzzles/[date]/preview">["params"] }) {
  const { date } = await params;
  await requireAdminPage(`/admin/puzzles/${date}/preview`);
  if (!z.iso.date().safeParse(date).success) notFound();
  const store = gameStore();
  const puzzle = store ? await store.getPuzzle(date) : null;
  if (!store || !puzzle) notFound();
  const ids = puzzle.rounds.flatMap((r) => [r.place_id, ...(r.wrong_place_ids ?? [])]);
  const places = new Map((await store.getPlaces(ids)).map((p) => [p.id, p]));
  const playable = toPlayableRounds(puzzle, places);

  return (
    <div className="space-y-4">
      <h1 className="text-[26px] font-bold text-ink">
        Preview: Day #{puzzle.number} <span className="font-normal text-secondary">· {formatShortDate(date)}</span>
      </h1>
      <ol className="grid gap-4 md:grid-cols-2">
        {playable.map((round, i) => {
          const answer = places.get(puzzle.rounds[i].place_id)!;
          return (
            <li key={i}>
              <AdminCard title={`Round ${i + 1}: ${round.mode === "pin" ? "Pin it" : "Name it"}`}>
                <div className="rounded-card border border-divider-soft p-4">
                  <p className="label-caps text-secondary">What the player sees</p>
                  {round.mode === "pin" ? (
                    <>
                      <span className="label-caps mt-2 inline-flex rounded-tag bg-background px-2 py-1 text-secondary">
                        {categoryLabel[round.category]}
                      </span>
                      <p className="mt-2 text-[20px] font-bold leading-snug text-ink">{round.name}</p>
                      <p className="mt-1 text-[15px] text-body">Pin where it used to be.</p>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-[14px] text-secondary">
                        <span className="font-semibold text-ink">Now:</span> {round.currentUse ?? "Not recorded"}
                      </p>
                      <p className="mt-1 text-[20px] font-bold leading-snug text-ink">What used to be here?</p>
                      <ul className="mt-2 space-y-1.5">
                        {round.choices.map((c) => (
                          <li
                            key={c.id}
                            className={`rounded-button border px-3 py-2 text-[15px] font-semibold ${
                              c.id === answer.id ? "border-[#2F7A4A] text-[#1F5E36]" : "border-divider text-ink"
                            }`}
                          >
                            {c.name}
                            {c.id === answer.id && <span className="ml-2 text-[12px]">(right answer)</span>}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
                <p className="label-caps mb-2 mt-4 text-secondary">The reveal</p>
                <EraCard
                  name={answer.name}
                  era={answer.era}
                  yearClosed={answer.yearClosed}
                  currentUse={answer.site.currentUse}
                  street={streetFromAddress(answer.site.addressText)}
                />
                {answer.fact && <p className="mt-2 text-[14px] leading-relaxed text-body">{answer.fact}</p>}
                <p className="mt-2 text-[12px] text-secondary">
                  Site: {answer.site.lat.toFixed(5)}, {answer.site.lng.toFixed(5)}
                  {answer.site.addressText ? ` · ${answer.site.addressText}` : ""}
                </p>
              </AdminCard>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function PreviewPage(props: PageProps<"/admin/puzzles/[date]/preview">) {
  return (
    <div>
      <Link href="/admin/puzzles" className="text-[14px] font-semibold text-ink hover:underline">
        ← Puzzles
      </Link>
      <div className="mt-3" />
      <Suspense fallback={<p className="label-caps text-secondary">Loading…</p>}>
        <Preview params={props.params} />
      </Suspense>
    </div>
  );
}
