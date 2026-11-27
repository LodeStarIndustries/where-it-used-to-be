// Re-importing the master sheet: decides, for each checked row, whether it's a
// new place, a change to an existing place (matched by name, ignoring case), or
// unchanged. Pure, so it's easy to test.
//
// Blank cells never erase: a blank in the sheet keeps what the database has.
// That's what keeps pins dropped in the admin when the sheet has no coordinates,
// and it protects anything else filled in through the admin.
import type { CsvRow } from "./csv";
import type { PlaceInput } from "./place-schema";

export interface ExistingPlace {
  id: string;
  siteId: string;
  /** Names of other places on the same site (site fields are shared with them). */
  siteSiblings: string[];
  place: PlaceInput;
}

export type PlannedRow =
  | { line: number; name: string; kind: "error"; errors: string[]; warnings: string[] }
  | { line: number; name: string; kind: "new"; place: PlaceInput; warnings: string[] }
  | {
      line: number;
      name: string;
      kind: "update";
      id: string;
      siteId: string;
      place: PlaceInput;
      changes: string[];
      warnings: string[];
    }
  | { line: number; name: string; kind: "same"; id: string; warnings: string[] };

export const nameKey = (name: string) => name.trim().toLowerCase();

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const near = (a: number | null, b: number | null) => (a === null || b === null ? a === b : Math.abs(a - b) < 1e-7);

/** The sheet row laid over the existing place: sheet values win, blanks keep the existing value. */
export function mergeOver(existing: PlaceInput, sheet: PlaceInput): PlaceInput {
  const keep = <T,>(v: T | null, old: T | null) => (v === null ? old : v);
  const pinned = sheet.lat !== null && sheet.lng !== null;
  return {
    name: sheet.name,
    category: sheet.category,
    addressText: keep(sheet.addressText, existing.addressText),
    lat: pinned ? sheet.lat : existing.lat,
    lng: pinned ? sheet.lng : existing.lng,
    currentUse: keep(sheet.currentUse, existing.currentUse),
    neighbourhood: keep(sheet.neighbourhood, existing.neighbourhood),
    yearOpened: keep(sheet.yearOpened, existing.yearOpened),
    yearClosed: keep(sheet.yearClosed, existing.yearClosed),
    era: keep(sheet.era, existing.era),
    fact: keep(sheet.fact, existing.fact),
    difficulty: keep(sheet.difficulty, existing.difficulty),
    sources: sheet.sources.length ? sheet.sources : existing.sources,
    notes: keep(sheet.notes, existing.notes),
  };
}

/** Plain-English names of the fields that differ. Site fields are flagged so shared sites can be warned about. */
export function changedFields(before: PlaceInput, after: PlaceInput): { fields: string[]; siteChanged: boolean } {
  const fields: string[] = [];
  let siteChanged = false;
  const site = (label: string, changed: boolean) => {
    if (changed) {
      fields.push(label);
      siteChanged = true;
    }
  };
  if (before.name !== after.name) fields.push("name");
  if (before.category !== after.category) fields.push("category");
  site("address", !same(before.addressText, after.addressText));
  site("pin", !near(before.lat, after.lat) || !near(before.lng, after.lng));
  site("current use", !same(before.currentUse, after.currentUse));
  site("neighbourhood", !same(before.neighbourhood, after.neighbourhood));
  if (before.yearOpened !== after.yearOpened || before.yearClosed !== after.yearClosed) fields.push("years");
  if (!same(before.era, after.era)) fields.push("era");
  if (!same(before.fact, after.fact)) fields.push("fact");
  if (!same(before.difficulty, after.difficulty)) fields.push("difficulty");
  if (!same(before.sources, after.sources)) fields.push("sources");
  site("notes", !same(before.notes, after.notes));
  return { fields, siteChanged };
}

export function planImport(rows: CsvRow[], existing: ExistingPlace[]): PlannedRow[] {
  const byName = new Map<string, ExistingPlace[]>();
  for (const e of existing) {
    const k = nameKey(e.place.name);
    byName.set(k, [...(byName.get(k) ?? []), e]);
  }

  return rows.map((r): PlannedRow => {
    const base = { line: r.line, name: r.name };
    if (!r.place) return { ...base, kind: "error", errors: r.errors, warnings: r.warnings };

    const matches = byName.get(nameKey(r.name)) ?? [];
    if (matches.length > 1) {
      return {
        ...base,
        kind: "error",
        errors: [`${matches.length} places in the database are called this. Rename one in the admin so the sheet can match it.`],
        warnings: [],
      };
    }
    if (matches.length === 0) return { ...base, kind: "new", place: r.place, warnings: r.warnings };

    const match = matches[0];
    const merged = mergeOver(match.place, r.place);
    const { fields, siteChanged } = changedFields(match.place, merged);
    // "Needs a pin" only matters for rows that still have no pin after merging.
    const warnings = r.warnings.filter((w) => !w.startsWith("Needs a pin") || merged.lat === null);
    if (fields.length === 0) return { ...base, kind: "same", id: match.id, warnings };
    if (siteChanged && match.siteSiblings.length) {
      warnings.push(`Shares its site with ${match.siteSiblings.join(", ")}, so address, pin and notes changes apply there too.`);
    }
    return { ...base, kind: "update", id: match.id, siteId: match.siteId, place: merged, changes: fields, warnings };
  });
}
