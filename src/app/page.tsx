import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { HomeStatus } from "@/components/home/HomeStatus";
import { checkHealth } from "@/lib/health";

/** Outside production only: which database this deployment uses. */
async function SetupCheck() {
  await connection();
  const health = await checkHealth();
  if (health.deploy === "production") return null;
  return (
    <section aria-labelledby="status-heading" className="mt-8 rounded-card border border-divider p-4">
      <h2 id="status-heading" className="label-caps text-secondary">
        Setup check ({health.deploy})
      </h2>
      <p className="mt-2 text-[13px] text-body">
        Database: {health.database}
        {health.databaseEnvironment ? ` (${health.databaseEnvironment})` : ""}.{" "}
        {health.problems.length > 0 ? <span className="text-accent">{health.problems.join(" ")}</span> : "All good."}
      </p>
    </section>
  );
}

const soon = ["Leaderboard", "Groups", "Suggest a place", "Sign in"];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-4 pb-10 pt-10">
      <h1 className="text-[32px] font-bold leading-tight text-ink">Where It Used To Be</h1>
      <p className="mt-2 text-[15px] text-body">
        A daily map game about the Saint John businesses that are gone. Five rounds, every day.
      </p>

      <HomeStatus />

      <nav aria-label="More" className="mt-6">
        <ul className="divide-y divide-divider-soft rounded-card bg-surface shadow-card">
          <li>
            <Link href="/how-to-play" className="flex items-center justify-between px-4 py-3.5 text-[15px] font-semibold text-ink">
              How to play <span aria-hidden="true">›</span>
            </Link>
          </li>
          {soon.map((label) => (
            <li key={label} className="flex items-center justify-between px-4 py-3.5 text-[15px] text-secondary">
              {label}
              <span className="label-caps">Soon</span>
            </li>
          ))}
        </ul>
      </nav>

      <Suspense fallback={null}>
        <SetupCheck />
      </Suspense>
    </main>
  );
}
