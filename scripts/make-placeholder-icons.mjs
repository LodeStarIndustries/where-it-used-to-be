#!/usr/bin/env node
// Placeholder app icons until Mike supplies the final artwork.
// Run: node scripts/make-placeholder-icons.mjs   (writes public/icons/* and src/app/icon.png, apple-icon.png)
import sharp from "sharp";

const ink = "#12324A";
const accent = "#B5452F";
const paper = "#EEF2F4";

// A map pin on a rounded ink tile. `safe` shrinks the pin into the maskable safe zone.
const svg = (size, { rounded = true, safe = false } = {}) => {
  const s = safe ? 0.62 : 0.78;
  const w = 100 * s;
  const x = (100 - w) / 2;
  const y = (100 - w) / 2 + (safe ? 2 : 1);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${rounded ? 22 : 0}" fill="${ink}"/>
  <g transform="translate(${x} ${y}) scale(${w / 100})">
    <path d="M50 8c-17.7 0-32 14-32 31.5C18 63 50 92 50 92s32-29 32-52.5C82 22 67.7 8 50 8z" fill="${accent}"/>
    <circle cx="50" cy="39" r="12.5" fill="${paper}"/>
  </g>
</svg>`;
};

const out = [
  ["public/icons/icon-192.png", 192, {}],
  ["public/icons/icon-512.png", 512, {}],
  ["public/icons/maskable-512.png", 512, { rounded: false, safe: true }],
  ["src/app/apple-icon.png", 180, { rounded: false }],
  ["src/app/icon.png", 64, {}],
];
for (const [file, size, opts] of out) {
  await sharp(Buffer.from(svg(size, opts))).png().toFile(file);
  console.log("wrote", file);
}
