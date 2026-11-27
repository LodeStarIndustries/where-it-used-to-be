// The "Save image" results card: /share-image?n=12&p=200,140,0,200,90
// Built only from the puzzle number and each round's points, so it never shows
// a place name (no spoilers for anyone who hasn't played yet). Anyone can make
// any card this way, same as typing the share text by hand; it isn't a record.
import { ImageResponse } from "next/og";
import { game, maxPointsPerDay } from "@config/game";
import { verdictFor } from "@/lib/game/scoring";
import { verdictColour } from "@/lib/game/verdict-colours";

const SIZE = 1080;
const ink = "#12324A";
const secondary = "#5C7182";
const background = "#EEF2F4";

function parse(url: URL): { number: number; points: number[] } | null {
  const number = Number(url.searchParams.get("n"));
  const points = (url.searchParams.get("p") ?? "").split(",").map(Number);
  const ok =
    Number.isInteger(number) &&
    number >= 1 &&
    number <= 100_000 &&
    points.length === game.roundsPerDay &&
    points.every((p) => Number.isInteger(p) && p >= 0 && p <= game.maxPointsPerRound);
  return ok ? { number, points } : null;
}

export function GET(request: Request) {
  const parsed = parse(new URL(request.url));
  if (!parsed) return new Response("Bad request", { status: 400 });
  const { number, points } = parsed;
  const total = points.reduce((a, b) => a + b, 0);
  const host = new URL(request.url).host;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background,
          padding: 72,
          color: ink,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 40 }}>
          <span style={{ fontWeight: 700 }}>Where It Used To Be</span>
          <span style={{ color: secondary }}>Day #{number}</span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            marginTop: 56,
            background: "#FFFFFF",
            borderRadius: 40,
            padding: 64,
            boxShadow: "0 2px 6px rgba(18,50,74,0.12)",
          }}
        >
          <span style={{ fontSize: 34, letterSpacing: 4, color: secondary, textTransform: "uppercase" }}>
            Today&apos;s score
          </span>
          <div style={{ display: "flex", alignItems: "baseline", marginTop: 16 }}>
            <span style={{ fontSize: 200, fontWeight: 700, lineHeight: 1 }}>{total}</span>
            <span style={{ fontSize: 64, color: secondary, marginLeft: 12 }}>/{maxPointsPerDay}</span>
          </div>
          <div style={{ display: "flex", height: 20, marginTop: 40, borderRadius: 10, background }}>
            <div
              style={{ width: `${(total / maxPointsPerDay) * 100}%`, height: 20, borderRadius: 10, background: "#B5452F" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 64 }}>
            {points.map((p, i) => {
              const v = verdictFor(p);
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 150 }}>
                  <div style={{ width: 96, height: 96, borderRadius: 24, background: verdictColour[v.key] }} />
                  <span style={{ marginTop: 16, fontSize: 34, fontWeight: 700 }}>{p}</span>
                  <span style={{ marginTop: 4, fontSize: 24, color: secondary, textAlign: "center" }}>{v.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 48, fontSize: 32, color: secondary }}>
          A daily Saint John map game · {host}
        </div>
      </div>
    ),
    {
      width: SIZE,
      height: SIZE,
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}
