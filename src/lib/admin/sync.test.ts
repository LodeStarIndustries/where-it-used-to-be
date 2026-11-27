import { describe, expect, it } from "vitest";
import { checkCsv, CSV_COLUMNS } from "./csv";
import type { PlaceInput } from "./place-schema";
import { planImport, type ExistingPlace } from "./sync";

const header = CSV_COLUMNS.join(",");
const blank: PlaceInput = {
  name: "",
  category: "bar",
  addressText: null,
  lat: null,
  lng: null,
  currentUse: null,
  neighbourhood: null,
  yearOpened: null,
  yearClosed: null,
  era: null,
  fact: null,
  difficulty: null,
  sources: [],
  notes: null,
};
const existing = (id: string, p: Partial<PlaceInput>, siblings: string[] = []): ExistingPlace => ({
  id,
  siteId: `site-${id}`,
  siteSiblings: siblings,
  place: { ...blank, ...p },
});
const rows = (...lines: string[]) => checkCsv([header, ...lines].join("\n"), { allowTestNames: true }).rows;

describe("planImport", () => {
  it("sorts rows into new, changed and unchanged, matching names without case", () => {
    const plan = planImport(
      rows(
        "Brand New,bar,,,,,,,,,,,,,,,,,",
        "old tavern,bar,,,,,,,,,A new fact.,,,,,,,,",
        "Same Diner,restaurant,,,,,,,,,,,,,,,,,",
      ),
      [
        existing("a", { name: "Old Tavern", category: "bar", fact: "Old fact." }),
        existing("b", { name: "Same Diner", category: "restaurant" }),
      ],
    );
    expect(plan.map((p) => p.kind)).toEqual(["new", "update", "same"]);
    const update = plan[1];
    if (update.kind !== "update") throw new Error();
    expect(update.id).toBe("a");
    expect(update.changes).toEqual(["name", "fact"]);
    expect(update.place.fact).toBe("A new fact.");
  });

  it("keeps the admin's pin and other values when the sheet's cells are blank", () => {
    const plan = planImport(rows("Pinned,bar,,,,,,1990,,,,,,,,,,,"), [
      existing("a", { name: "Pinned", lat: 45.27, lng: -66.06, fact: "Kept.", sources: [{ label: "S", url: "https://a.ca" }] }),
    ]);
    const p = plan[0];
    if (p.kind !== "update") throw new Error(p.kind);
    expect(p.changes).toEqual(["years"]);
    expect(p.place).toMatchObject({ lat: 45.27, lng: -66.06, fact: "Kept.", yearOpened: 1990 });
    expect(p.place.sources).toHaveLength(1);
    expect(p.warnings.some((w) => w.startsWith("Needs a pin"))).toBe(false);
  });

  it("moves the pin when the sheet has coordinates, and warns about shared sites", () => {
    const plan = planImport(rows("Moved,bar,,45.28,-66.05,,,,,,,,,,,,,,"), [
      existing("a", { name: "Moved", lat: 45.27, lng: -66.06 }, ["Next Door Cafe"]),
    ]);
    const p = plan[0];
    if (p.kind !== "update") throw new Error(p.kind);
    expect(p.changes).toEqual(["pin"]);
    expect(p.warnings.join(" ")).toContain("Next Door Cafe");
  });

  it("refuses a name two database places share, and passes row errors through", () => {
    const plan = planImport(rows("Twin,bar,,,,,,,,,,,,,,,,,", "Bad,spaceship,,,,,,,,,,,,,,,,,"), [
      existing("a", { name: "Twin" }),
      existing("b", { name: "twin" }),
    ]);
    expect(plan[0].kind).toBe("error");
    expect(plan[1].kind).toBe("error");
  });

  it("treats sources stored with their keys in another order as unchanged", () => {
    const stored = { url: "https://a.ca", label: "A" } as unknown as { label: string; url: string };
    const plan = planImport(rows("Kept,bar,,,,,,,,,,,A,https://a.ca,,,,,"), [
      existing("a", { name: "Kept", sources: [stored] }),
    ]);
    expect(plan[0].kind).toBe("same");
  });
});
