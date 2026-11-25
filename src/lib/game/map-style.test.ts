// Hard rule 3: the game map shows streets and street names only.
// Runs against a saved copy of OpenFreeMap's Positron style.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gameMapStyle, type MapStyle } from "./map-style";

const base = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "..", "tests", "fixtures", "openfreemap-positron.json"), "utf8"),
) as MapStyle;

describe("game map style", () => {
  const style = gameMapStyle(base);
  const symbols = style.layers.filter((l) => l.type === "symbol");

  it("keeps only street-name labels", () => {
    expect(symbols.map((l) => l.id).sort()).toEqual(["highway-name-major", "highway-name-minor", "highway-name-path"]);
    for (const l of symbols) expect(l["source-layer"]).toBe("transportation_name");
  });

  it("has no business, POI, transit, place, house-number, water or shield labels", () => {
    const banned = ["poi", "housenumber", "place", "water_name", "aerodrome_label", "mountain_peak"];
    for (const l of style.layers) expect(banned).not.toContain(l["source-layer"]);
    for (const l of symbols) expect(l.layout?.["icon-image"]).toBeUndefined();
  });

  it("still draws the streets themselves", () => {
    expect(style.layers.some((l) => l.type === "line" && l["source-layer"] === "transportation")).toBe(true);
  });

  it("uses the Visual direction colours", () => {
    const bg = style.layers.find((l) => l.type === "background")!;
    expect(bg.paint?.["background-color"]).toBe("#EEF2F4");
    expect(style.layers.find((l) => l.id === "water")!.paint?.["fill-color"]).toBe("#BFD6E3");
    expect(style.layers.find((l) => l.id === "park")!.paint?.["fill-color"]).toBe("#D5E6D3");
    for (const l of symbols) expect(l.paint?.["text-color"]).toBe("#5C7182");
  });

  it("leaves the attribution and sources alone", () => {
    expect(style.sources).toEqual(base.sources);
  });
});
