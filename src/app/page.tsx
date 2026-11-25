import { Suspense } from "react";
import { connection } from "next/server";
import { checkHealth } from "@/lib/health";

// Milestone 1 placeholder. The real Home screen arrives in Milestone 2.

function formatDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

async function Status() {
  await connection();
  const health = await checkHealth();
  const showDetails = health.deploy !== "production";

  return (
    <>
      <p className="label-caps text-secondary">
        {health.puzzleNumber >= 1 ? `Day #${health.puzzleNumber}` : `Launches in ${1 - health.puzzleNumber} days`}
      </p>
      <p className="mt-1 text-[15px] text-body">{formatDate(health.puzzleDate)}</p>

      {showDetails && (
        <section aria-labelledby="status-heading" className="mt-6 rounded-card bg-surface p-4 shadow-card">
          <h2 id="status-heading" className="label-caps text-secondary">
            Setup check
          </h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[14px]">
            <dt className="text-secondary">Deployment</dt>
            <dd className="font-medium text-ink">{health.deploy}</dd>
            <dt className="text-secondary">Database</dt>
            <dd className="font-medium text-ink">
              {health.database}
              {health.databaseEnvironment ? ` (${health.databaseEnvironment})` : ""}
            </dd>
          </dl>
          {health.problems.length > 0 ? (
            <ul className="mt-3 space-y-1 border-t border-divider-soft pt-3 text-[14px] text-accent">
              {health.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 border-t border-divider-soft pt-3 text-[14px] text-ink">All good.</p>
          )}
        </section>
      )}
    </>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-4 py-10">
      <h1 className="text-[32px] font-bold leading-tight text-ink">Where It Used To Be</h1>
      <p className="mt-2 text-[15px] text-body">
        A daily map game about the Saint John businesses that are gone. Coming soon.
      </p>

      <div className="mt-8">
        <Suspense fallback={<p className="label-caps text-secondary">Loading…</p>}>
          <Status />
        </Suspense>
      </div>

      <button
        type="button"
        disabled
        className="mt-8 h-button rounded-button bg-ink text-[15px] font-semibold text-white disabled:opacity-60"
      >
        Play (coming in Milestone 2)
      </button>
    </main>
  );
}
