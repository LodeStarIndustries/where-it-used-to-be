import Link from "next/link";
import { Suspense } from "react";
import { game } from "@config/game";
import { dashboardStats } from "@/lib/admin/data";
import { resolveEventAction } from "@/lib/admin/actions";
import { requireAdminPage } from "@/lib/admin/guard";
import { formatShortDate } from "@/lib/format";
import { AdminCard, Pill, Stat, adminButtonSecondary } from "@/components/admin/ui";

async function Dashboard() {
  await requireAdminPage("/admin");
  const s = await dashboardStats();
  const daysLeft = Math.floor(s.neverUsedLive / game.roundsPerDay);
  const missing = s.nextDays.filter((d) => !d.ready).length;

  return (
    <div className="space-y-6">
      <h1 className="text-[26px] font-bold text-ink">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Live places" value={s.live} href="/admin/places?status=live" />
        <Stat label="Drafts" value={s.draft} href="/admin/places?status=draft" />
        <Stat label="Need a pin" value={s.needsPin} href="/admin/places?status=draft&needsPin=1" tone={s.needsPin ? "warn" : "plain"} />
        <Stat
          label="Ready to go live"
          value={s.readyToGoLive}
          href="/admin/places?status=draft&ready=1"
          tone={s.readyToGoLive ? "good" : "plain"}
        />
        <Stat
          label="Pending submissions"
          value={s.pendingSubmissions}
          href="/admin/submissions"
          tone={s.pendingSubmissions ? "warn" : "plain"}
        />
        <Stat label="Days of unused places" value={daysLeft} tone={daysLeft < 7 ? "warn" : "plain"} />
        <Stat label="Puzzles through" value={s.scheduledThrough ? formatShortDate(s.scheduledThrough) : "None"} href="/admin/puzzles" />
        <Stat label="Retired" value={s.retired} href="/admin/places?status=retired" />
      </div>
      <p className="text-[13px] text-secondary">
        Days of unused places: live places never used in a puzzle, five a day. Places only repeat once these run out.
      </p>

      <AdminCard
        title="Next 7 days"
        actions={
          <Link href="/admin/puzzles" className={adminButtonSecondary}>
            {missing ? `Generate ${missing} missing` : "Puzzle calendar"}
          </Link>
        }
      >
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {s.nextDays.map((d) => (
            <li key={d.date}>
              <Link
                href={`/admin/puzzles/${d.date}`}
                className="block rounded-button border border-divider-soft p-2 hover:border-ink/30"
              >
                <p className="text-[13px] font-semibold text-ink">{formatShortDate(d.date)}</p>
                <p className="text-[12px] text-secondary">Day #{d.number}</p>
                <p className="mt-1">{d.ready ? <Pill tone="live">Ready</Pill> : <Pill tone="warn">Missing</Pill>}</p>
              </Link>
            </li>
          ))}
        </ul>
      </AdminCard>

      <AdminCard title="Problems to look at">
        {s.openEvents.length === 0 ? (
          <p className="text-[14px] text-body">Nothing open.</p>
        ) : (
          <ul className="divide-y divide-divider-soft">
            {s.openEvents.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-[14px] text-ink">{e.message}</p>
                  <p className="text-[12px] text-secondary">
                    {e.kind} · {new Date(e.createdAt).toLocaleString("en-CA", { timeZone: "America/Moncton" })}
                  </p>
                </div>
                <form action={resolveEventAction}>
                  <input type="hidden" name="id" value={e.id} />
                  <button type="submit" className={adminButtonSecondary}>
                    Mark resolved
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<p className="label-caps text-secondary">Loading…</p>}>
      <Dashboard />
    </Suspense>
  );
}
