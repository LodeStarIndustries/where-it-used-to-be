"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { rerollWrongAnswersAction, savePuzzleDayAction, type ActionResult } from "@/lib/admin/actions";
import type { GeneratedRound } from "@/lib/game/generator";
import { adminButton, adminButtonSecondary, adminInput } from "./ui";

export interface PoolOption {
  id: string;
  siteId: string;
  name: string;
  difficulty: number;
  lastUsedOn: string | null;
}

export function DayEditor(props: {
  date: string;
  rounds: GeneratedRound[];
  pool: PoolOption[];
  names: Record<string, string>;
}) {
  const { date, pool, names } = props;
  const router = useRouter();
  const [rounds, setRounds] = useState<GeneratedRound[]>(props.rounds);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(rounds) !== JSON.stringify(props.rounds);
  const byId = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool]);
  const label = (id: string) => byId.get(id)?.name ?? names[id] ?? "A place that isn't live";
  const sorted = useMemo(() => [...pool].sort((a, b) => a.name.localeCompare(b.name)), [pool]);

  function reroll(index: number, next: GeneratedRound[]) {
    start(async () => {
      const r = await rerollWrongAnswersAction(date, next, index);
      if (r.ok) {
        setRounds(next.map((x, i) => (i === index ? { ...x, mode: "name", wrong_place_ids: r.wrong } : x)));
        setResult(null);
      } else {
        setRounds(next);
        setResult(r);
      }
    });
  }

  function changePlace(index: number, placeId: string) {
    const next = rounds.map((r, i) => (i === index ? { ...r, place_id: placeId } : r));
    if (next[index].mode === "name") reroll(index, next);
    else setRounds(next);
  }

  function changeMode(index: number, mode: "pin" | "name") {
    const next = rounds.map((r, i) => (i === index ? { place_id: r.place_id, mode } : r));
    if (mode === "name") reroll(index, next);
    else setRounds(next);
  }

  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        {rounds.map((r, i) => {
          const otherSites = new Set(rounds.filter((_, j) => j !== i).map((x) => byId.get(x.place_id)?.siteId));
          return (
            <li key={i} className="rounded-card bg-surface p-4 shadow-card">
              <div className="grid gap-3 md:grid-cols-[auto_1fr_160px] md:items-end">
                <p className="text-[15px] font-bold text-ink md:pb-2">Round {i + 1}</p>
                <label>
                  <span className="block text-[13px] font-semibold text-ink">Place</span>
                  <select value={r.place_id} onChange={(e) => changePlace(i, e.target.value)} className={adminInput} disabled={pending}>
                    {!byId.has(r.place_id) && <option value={r.place_id}>{label(r.place_id)}</option>}
                    {sorted.map((p) => (
                      <option key={p.id} value={p.id} disabled={otherSites.has(p.siteId)}>
                        {p.name} · difficulty {p.difficulty} · {p.lastUsedOn ? `used ${p.lastUsedOn}` : "never used"}
                        {otherSites.has(p.siteId) ? " (same site as another round)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="block text-[13px] font-semibold text-ink">Round type</span>
                  <select
                    value={r.mode}
                    onChange={(e) => changeMode(i, e.target.value as "pin" | "name")}
                    className={adminInput}
                    disabled={pending}
                  >
                    <option value="pin">Pin it</option>
                    <option value="name">Name it</option>
                  </select>
                </label>
              </div>
              {r.mode === "name" && (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px]">
                  <span className="text-secondary">Wrong answers:</span>
                  <span className="text-ink">{(r.wrong_place_ids ?? []).map(label).join(" · ") || "none yet"}</span>
                  <button type="button" className={adminButtonSecondary} disabled={pending} onClick={() => reroll(i, rounds)}>
                    Re-roll
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-[13px] text-secondary">
        Rounds play in this order. The generator sorts them easy to hard; keep that in mind if you swap places.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={adminButton}
          disabled={pending || !dirty}
          onClick={() =>
            start(async () => {
              const r = await savePuzzleDayAction(date, rounds);
              setResult(r);
              if (r.ok) router.refresh();
            })
          }
        >
          {pending ? "Working…" : "Save this day"}
        </button>
        {dirty && (
          <button type="button" className={adminButtonSecondary} disabled={pending} onClick={() => setRounds(props.rounds)}>
            Undo changes
          </button>
        )}
        {result && (
          <p className={`text-[14px] ${result.ok ? "text-[#1F5E36]" : "text-[#8F2F1C]"}`} role={result.ok ? "status" : "alert"}>
            {result.ok ? result.message : result.errors.join(" ")}
          </p>
        )}
      </div>
    </div>
  );
}
