import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { HomeStatus } from "@/components/home/HomeStatus";
import { getProfile } from "@/lib/account/data";
import { currentUserId } from "@/lib/auth/session";
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

const soon = ["Suggest a place"];

const linkClass = "flex items-center justify-between px-4 py-3.5 text-[15px] font-semibold text-ink";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className={linkClass}>
        {children} <span aria-hidden="true">›</span>
      </Link>
    </li>
  );
}

/** Sign in, or the player's profile once signed in. */
async function AccountLink() {
  const userId = await currentUserId();
  const profile = userId ? await getProfile(userId) : null;
  if (!profile) return <NavLink href="/sign-in">Sign in</NavLink>;
  return (
    <NavLink href="/profile">
      <span>
        Profile <span className="font-normal text-secondary">· {profile.displayName ?? "Pick a name"}</span>
      </span>
    </NavLink>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-4 pb-10 min-[431px]:pt-6">
      <h1 className="sr-only">Where It Used To Be: a daily map game about the Saint John businesses that are gone</h1>

      <HomeStatus />

      <nav aria-label="More" className="mt-6">
        <ul className="divide-y divide-divider-soft rounded-card bg-surface shadow-card">
          <NavLink href="/leaderboard">Leaderboard</NavLink>
          <NavLink href="/groups">Groups</NavLink>
          {soon.map((label) => (
            <li key={label} className="flex items-center justify-between px-4 py-3.5 text-[15px] text-secondary">
              {label}
              <span className="label-caps">Soon</span>
            </li>
          ))}
          <Suspense fallback={<li className={`${linkClass} text-secondary`}>Sign in</li>}>
            <AccountLink />
          </Suspense>
        </ul>
      </nav>

      <Suspense fallback={null}>
        <SetupCheck />
      </Suspense>
    </main>
  );
}
