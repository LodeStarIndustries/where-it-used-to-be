import type { MetadataRoute } from "next";

// Makes the game installable ("Add to Home Screen"). Offline play isn't required,
// so there's no service worker. Icons are placeholders until Mike's final artwork
// (regenerate with scripts/make-placeholder-icons.mjs, or replace the PNGs).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Where It Used To Be",
    short_name: "Used To Be",
    description: "A free daily map game about the Saint John businesses that are gone.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#EEF2F4",
    theme_color: "#EEF2F4",
    lang: "en-CA",
    categories: ["games"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
