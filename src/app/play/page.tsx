import type { Metadata } from "next";
import { Game } from "@/components/game/Game";

export const metadata: Metadata = {
  title: "Play · Where It Used To Be",
};

export default function PlayPage() {
  return <Game />;
}
