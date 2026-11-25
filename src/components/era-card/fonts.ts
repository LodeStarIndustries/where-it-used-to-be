// Era card fonts. preload: false means the browser downloads each font only when
// a card in that era's style is actually shown.
import { Alfa_Slab_One, Bungee, Exo_2, Montserrat, Righteous, Shrikhand } from "next/font/google";

export const shrikhand = Shrikhand({ weight: "400", subsets: ["latin"], preload: false, display: "swap" });
export const bungee = Bungee({ weight: "400", subsets: ["latin"], preload: false, display: "swap" });
export const righteous = Righteous({ weight: "400", subsets: ["latin"], preload: false, display: "swap" });
export const exo2 = Exo_2({ weight: "800", style: "italic", subsets: ["latin"], preload: false, display: "swap" });
export const montserrat = Montserrat({ weight: "500", subsets: ["latin"], preload: false, display: "swap" });
export const alfaSlabOne = Alfa_Slab_One({ weight: "400", subsets: ["latin"], preload: false, display: "swap" });
