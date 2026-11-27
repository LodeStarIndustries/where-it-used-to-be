import { notFound } from "next/navigation";
import { EraCard } from "@/components/era-card/EraCard";
import { deployEnvironment } from "@/lib/env";

// Development and preview only: every era card style, full and mini, with a short
// and a long name, for checking against the Visual direction spec.
const eras = ["1970s", "1980s", "1990s", "2000s", "2010s", null] as const;
const long = "TEST: The Extremely Long-Named Family Restaurant and Lounge";

export default function EraCardsPreview() {
  if (deployEnvironment() === "production") notFound();
  return (
    <main className="mx-auto w-full max-w-[430px] space-y-8 px-4 py-8">
      <h1 className="text-[24px] font-bold text-ink">Era cards</h1>
      {eras.map((era) => (
        <section key={era ?? "none"} className="space-y-3">
          <h2 className="label-caps text-secondary">{era ?? "No era (fallback)"}</h2>
          <EraCard name="TEST: Corner Diner" era={era} yearClosed={1994} currentUse="TEST: Pharmacy" street="King St" />
          <EraCard name={long} era={era} yearClosed={2003} currentUse="TEST: Parking lot" street="Golden Grove Rd" />
          <EraCard mini name="TEST: Corner Diner" era={era} />
        </section>
      ))}
    </main>
  );
}
