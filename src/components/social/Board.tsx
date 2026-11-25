import Link from "next/link";
import { game } from "@config/game";
import type { BoardRow, WeekRow } from "@/lib/account/data";
import { RoundDots } from "@/components/game/RoundDots";

/** A day's leaderboard. The viewer's own row is highlighted, with a gap if it's below the top rows. */
export function DayBoard({ rows, empty }: { rows: BoardRow[]; empty: string }) {
  if (rows.length === 0) return <p className="mt-3 text-[15px] text-body">{empty}</p>;
  return (
    <ol className="mt-2 divide-y divide-divider-soft" aria-label="Leaderboard">
      {rows.map((r, i) => (
        <li
          key={`${r.rank}-${r.displayName}`}
          className={`flex items-center gap-3 py-2.5 ${r.isMe ? "-mx-2 rounded-button bg-background px-2" : ""} ${
            i > 0 && r.rank > rows[i - 1].rank + 1 ? "mt-3 border-t-2 border-dashed" : ""
          }`}
          aria-current={r.isMe ? "true" : undefined}
        >
          <span className="w-8 shrink-0 text-right text-[15px] font-bold tabular-nums text-secondary">{r.rank}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-ink">
              {r.displayName}
              {r.isMe && <span className="font-normal text-secondary"> (you)</span>}
            </span>
            {r.roundPoints && r.roundPoints.length > 0 && <RoundDots points={r.roundPoints} />}
          </span>
          <span className="text-[15px] font-bold tabular-nums text-ink">{r.totalPoints}</span>
        </li>
      ))}
    </ol>
  );
}

export function WeekBoard({ rows }: { rows: WeekRow[] }) {
  if (rows.length === 0) return <p className="mt-3 text-[15px] text-body">Nobody in this group has finished a puzzle this week yet.</p>;
  return (
    <ol className="mt-2 divide-y divide-divider-soft" aria-label="This week">
      {rows.map((r) => (
        <li
          key={`${r.rank}-${r.displayName}`}
          className={`flex items-center gap-3 py-2.5 ${r.isMe ? "-mx-2 rounded-button bg-background px-2" : ""}`}
          aria-current={r.isMe ? "true" : undefined}
        >
          <span className="w-8 shrink-0 text-right text-[15px] font-bold tabular-nums text-secondary">{r.rank}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-ink">
              {r.displayName}
              {r.isMe && <span className="font-normal text-secondary"> (you)</span>}
            </span>
            <span className="block text-[13px] text-secondary">
              {r.daysPlayed} of {game.leaderboard.groupHistoryDays} days
            </span>
          </span>
          <span className="text-[15px] font-bold tabular-nums text-ink">{r.totalPoints.toLocaleString("en-CA")}</span>
        </li>
      ))}
    </ol>
  );
}

/** Link-styled tabs. Each tab is a URL, so they work without JavaScript and can be shared. */
export function Tabs({ tabs, label }: { tabs: { href: string; label: string; current: boolean }[]; label: string }) {
  return (
    <nav aria-label={label} className="mt-4 -mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2">
        {tabs.map((t) => (
          <li key={t.href} className="shrink-0">
            <Link
              href={t.href}
              aria-current={t.current ? "page" : undefined}
              className={`inline-flex h-9 items-center rounded-full px-4 text-[14px] font-semibold ${
                t.current ? "bg-ink text-white" : "bg-surface text-ink shadow-card"
              }`}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
