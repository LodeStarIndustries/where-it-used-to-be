import type { Metadata } from "next";
import Link from "next/link";
import { MapAttribution } from "@/components/ui/MapAttribution";

export const metadata: Metadata = {
  title: "About · Where It Used To Be",
};

// Placeholder copy for Mike to replace.
export default function About() {
  return (
    <main className="mx-auto w-full max-w-[430px] px-4 pb-12 pt-6">
      <Link href="/" className="text-[14px] font-semibold text-ink underline-offset-2 hover:underline">
        ← Home
      </Link>
      <h1 className="mt-4 text-[28px] font-bold leading-tight text-ink">About</h1>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-body">
        <p>
          Where It Used To Be is a free daily map game about the Saint John businesses that are gone: the stores,
          restaurants, theatres and hangouts people still give directions by.
        </p>
        <p>
          Every place in the game is checked against sources before it goes live, and each one links to them. If you
          remember a place we&apos;re missing, <Link href="/suggest" className="font-semibold text-ink underline underline-offset-2">suggest it</Link>.
        </p>
        <p>The game has no ads, and only keeps what it needs to run. See the <Link href="/privacy" className="font-semibold text-ink underline underline-offset-2">privacy notes</Link>.</p>
        <p className="rounded-card bg-surface p-4 text-[14px] text-secondary shadow-card">
          Placeholder text. Who made the game, how to get in touch, and thanks go here.
        </p>
      </div>
      <MapAttribution />
    </main>
  );
}
