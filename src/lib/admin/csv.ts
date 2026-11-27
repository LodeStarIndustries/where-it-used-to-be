// The starter-list CSV: parsing, checking each row, and writing it back out.
// Pure, so it's easy to test. Columns follow the spec; extra columns (like the
// Google Sheet's verified_by_mike, import_check and checked_from) are ignored.
import { checkPlace, type PlaceInput } from "./place-schema";

export const CSV_COLUMNS = [
  "name",
  "category",
  "address_text",
  "lat",
  "lng",
  "current_use",
  "neighbourhood",
  "year_opened",
  "year_closed",
  "era",
  "fact",
  "difficulty",
  "source_1_label",
  "source_1_url",
  "source_2_label",
  "source_2_url",
  "source_3_label",
  "source_3_url",
  "notes",
] as const;

type Column = (typeof CSV_COLUMNS)[number];

/** RFC 4180 parsing: quoted fields, doubled quotes, commas and line breaks inside quotes, CRLF, a BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop rows that are entirely empty (trailing newlines, spacer rows).
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

const escape = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((r) => r.map(escape).join(",")).join("\r\n") + "\r\n";
}

export interface CsvRow {
  /** Line in the file, counting the header as 1. */
  line: number;
  name: string;
  place: PlaceInput | null;
  errors: string[];
  warnings: string[];
}

export interface CsvCheck {
  /** File-level problems (missing columns, empty file). Nothing can be imported while there are any. */
  fileErrors: string[];
  ignoredColumns: string[];
  rows: CsvRow[];
}

/** Reads a CSV file into checked rows. Nothing is written; this is the dry run's first half. */
export function checkCsv(text: string, opts: { allowTestNames: boolean }): CsvCheck {
  const table = parseCsv(text);
  if (table.length === 0) return { fileErrors: ["The file is empty."], ignoredColumns: [], rows: [] };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const index = new Map<string, number>();
  header.forEach((h, i) => {
    if (!index.has(h)) index.set(h, i);
  });
  const fileErrors: string[] = [];
  for (const required of ["name", "category"] as const) {
    if (!index.has(required)) fileErrors.push(`The header row needs a "${required}" column.`);
  }
  const ignoredColumns = header.filter((h) => h && !(CSV_COLUMNS as readonly string[]).includes(h));
  if (table.length === 1) fileErrors.push("The file has a header row but no places.");
  if (fileErrors.length) return { fileErrors, ignoredColumns, rows: [] };

  const seen = new Map<string, number>();
  const rows = table.slice(1).map((cells, i): CsvRow => {
    const line = i + 2;
    const get = (c: Column) => {
      const at = index.get(c);
      return at === undefined ? "" : (cells[at] ?? "").trim();
    };
    const sources = ([1, 2, 3] as const)
      .map((n) => ({ label: get(`source_${n}_label`), url: get(`source_${n}_url`) }))
      .filter((s) => s.label || s.url)
      .map((s) => ({ label: s.label || s.url, url: s.url }));

    const result = checkPlace({
      name: get("name"),
      category: get("category").toLowerCase(),
      addressText: get("address_text"),
      lat: get("lat"),
      lng: get("lng"),
      currentUse: get("current_use"),
      neighbourhood: get("neighbourhood"),
      yearOpened: get("year_opened"),
      yearClosed: get("year_closed"),
      era: get("era"),
      fact: get("fact"),
      difficulty: get("difficulty"),
      sources,
      notes: get("notes"),
    });

    const name = get("name");
    const errors = result.ok ? [] : [...result.errors];
    const warnings: string[] = [];
    if (!opts.allowTestNames && /^test:/i.test(name)) {
      errors.push("TEST: names can't go into this database.");
    }
    const key = name.toLowerCase();
    if (key && seen.has(key)) warnings.push(`Same name as line ${seen.get(key)} in this file.`);
    else if (key) seen.set(key, line);
    if (result.ok && result.place.lat === null) warnings.push("Needs a pin: no coordinates.");

    return { line, name, place: result.ok && errors.length === 0 ? result.place : null, errors, warnings };
  });

  return { fileErrors, ignoredColumns, rows };
}

/** One place as an export row, in CSV_COLUMNS order. */
export function placeToCsvRow(p: PlaceInput): string[] {
  const s = (v: string | number | null) => (v === null ? "" : String(v));
  const src = (n: number) => p.sources[n] ?? { label: "", url: "" };
  return [
    p.name,
    p.category,
    s(p.addressText),
    s(p.lat),
    s(p.lng),
    s(p.currentUse),
    s(p.neighbourhood),
    s(p.yearOpened),
    s(p.yearClosed),
    s(p.era),
    s(p.fact),
    s(p.difficulty),
    src(0).label,
    src(0).url,
    src(1).label,
    src(1).url,
    src(2).label,
    src(2).url,
    s(p.notes),
  ];
}
