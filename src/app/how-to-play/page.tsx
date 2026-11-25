import type { Metadata } from "next";
import Link from "next/link";
import { game, maxPointsPerDay } from "@config/game";

export const metadata: Metadata = {
  title: "How to play · Where It Used To Be",
};

// Placeholder copy for Mike to replace (Milestone 5 polishes this page).
export default function HowToPlay() {
  return (
    <main className="mx-auto w-full max-w-[430px] px-4 pb-12 pt-6">
      <Link href="/" className="text-[14px] font-semibold text-ink underline-offset-2 hover:underline">
        ← Home
      </Link>
      <h1 className="mt-4 text-[28px] font-bold leading-tight text-ink">How to play</h1>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-body">
        <p>
          Every day there are {game.roundsPerDay} rounds about Saint John businesses that are gone. Everyone gets the
          same puzzle, and a new one starts at midnight in Saint John.
        </p>
        <p>
          <strong className="text-ink">Pin it.</strong> You get a business name. Tap the map where you think it used to
          be, drag the pin if you need to, then press Lock it in. The closer you are, the more points: a full{" "}
          {game.maxPointsPerRound} within 50 m.
        </p>
        <p>
          <strong className="text-ink">Name it.</strong> The map shows a spot and what&apos;s there now. Pick what used
          to be there from four choices.
        </p>
        <p>
          Each round is final once you submit it. The best possible day is {maxPointsPerDay.toLocaleString("en-CA")}{" "}
          points. Play every day to build your streak.
        </p>
        <p>
          On a keyboard, focus the map, move it with the arrow keys, and press Enter to drop your pin at the centre.
        </p>
      </div>
      <p className="mt-8 text-[12px] text-secondary">
        Map data © OpenStreetMap contributors, served by OpenFreeMap with OpenMapTiles.
      </p>
    </main>
  );
}
