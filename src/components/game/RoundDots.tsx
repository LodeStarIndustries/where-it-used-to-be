import { verdictFor } from "@/lib/game/scoring";
import { verdictColour } from "@/lib/game/verdict-colours";

/** Five small dots, one per round, coloured by verdict. */
export function RoundDots({ points }: { points: number[] }) {
  const labels = points.map((p) => `${verdictFor(p).label} (${p})`).join(", ");
  return (
    <span className="inline-flex gap-1" role="img" aria-label={`Rounds: ${labels}`}>
      {points.map((p, i) => (
        <span key={i} className="block size-2.5 rounded-full" style={{ background: verdictColour[verdictFor(p).key] }} />
      ))}
    </span>
  );
}
