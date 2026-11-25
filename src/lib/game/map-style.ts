// Turns OpenFreeMap's Positron style into the game map (hard rule 3):
// streets and street names only. Every other label (businesses, points of interest,
// shops, transit, place names, house numbers, water names, road shields) is removed,
// and the colours follow the Visual direction tokens.

// Loose types: we only touch a few fields and pass the rest through unchanged.
export interface StyleLayer {
  id: string;
  type: string;
  "source-layer"?: string;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface MapStyle {
  layers: StyleLayer[];
  [key: string]: unknown;
}

const colours = {
  land: "#EEF2F4",
  road: "#FFFFFF",
  roadCasing: "#D3DCE2",
  park: "#D5E6D3",
  water: "#BFD6E3",
  label: "#5C7182",
  building: "#E3E9ED",
};

/** Street-name layers: line labels from the transportation_name source layer, no shields. */
export function isStreetNameLayer(layer: StyleLayer): boolean {
  return (
    layer.type === "symbol" &&
    layer["source-layer"] === "transportation_name" &&
    layer.layout?.["symbol-placement"] === "line" &&
    layer.layout?.["icon-image"] === undefined
  );
}

export function gameMapStyle(base: MapStyle): MapStyle {
  const layers = base.layers
    .filter((layer) => layer.type !== "symbol" || isStreetNameLayer(layer))
    // No point-of-interest or house-number data, even as shapes.
    .filter((layer) => !["poi", "housenumber", "aerodrome_label", "mountain_peak"].includes(layer["source-layer"] ?? ""))
    .map((layer): StyleLayer => {
      const paint = { ...layer.paint };
      const layout = { ...layer.layout };
      const sl = layer["source-layer"];
      if (layer.type === "background") paint["background-color"] = colours.land;
      else if (layer.type === "fill" && sl === "park") paint["fill-color"] = colours.park;
      else if (layer.type === "fill" && sl === "water") paint["fill-color"] = colours.water;
      else if (layer.type === "line" && sl === "waterway") paint["line-color"] = colours.water;
      else if (layer.type === "fill" && sl === "building") paint["fill-color"] = colours.building;
      else if (layer.type === "line" && sl === "transportation" && !layer.id.includes("railway")) {
        paint["line-color"] = layer.id.includes("casing") ? colours.roadCasing : colours.road;
      } else if (isStreetNameLayer(layer)) {
        // OpenFreeMap serves Noto Sans glyphs only; Inter isn't available for map labels.
        layout["text-font"] = ["Noto Sans Regular"];
        layout["text-size"] = 11;
        paint["text-color"] = colours.label;
        paint["text-halo-color"] = colours.road;
        paint["text-halo-width"] = 1.5;
      }
      return { ...layer, paint, layout };
    });
  return { ...base, layers };
}
