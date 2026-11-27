import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CSV_COLUMNS, checkCsv, parseCsv, placeToCsvRow, toCsv } from "./csv";

const header = CSV_COLUMNS.join(",");

describe("CSV parsing", () => {
  it("handles quotes, doubled quotes, commas and line breaks inside fields, CRLF and a BOM", () => {
    const text = '﻿a,b,c\r\n"x, y","say ""hi""","two\nlines"\r\n\r\nplain,,end\n';
    expect(parseCsv(text)).toEqual([
      ["a", "b", "c"],
      ["x, y", 'say "hi"', "two\nlines"],
      ["plain", "", "end"],
    ]);
  });

  it("round-trips through toCsv", () => {
    const rows = [["name", "fact"], ["Joe's", 'He said "bye", then left\nfor good']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe("CSV checking (the dry run)", () => {
  it("reads the sample file: three valid rows, two needing pins", () => {
    const text = readFileSync(join(__dirname, "..", "..", "..", "samples", "places-sample.csv"), "utf8");
    const result = checkCsv(text, { allowTestNames: true });
    expect(result.fileErrors).toEqual([]);
    expect(result.rows.map((r) => r.errors)).toEqual([[], [], []]);
    expect(result.rows.map((r) => r.warnings.some((w) => w.includes("Needs a pin")))).toEqual([false, true, true]);
    expect(result.rows[0].place).toMatchObject({
      name: "TEST: Harbourside Diner",
      lat: 45.2702,
      era: "1980s",
      difficulty: 1,
      sources: [{ label: "TEST source", url: "https://example.com/diner" }],
    });
    expect(result.rows[0].place?.fact).toContain('"quotes" and a comma');
    expect(result.rows[2].place?.era).toBeNull();
  });

  it("reports each row's problems without stopping the others", () => {
    const text = [
      header,
      "Good Place,restaurant,1 Main St,,,,,1980,1990,1980s,A fact.,2,,,,,,,",
      "Bad Category,spaceport,,,,,,,,,,,,,,,,,",
      "Bad Years,bar,,,,,,1999,1980,,,,,,,,,,",
      "Bad Era,bar,,,,,,,,1960s,,4,,,,,,,",
      "Half Pin,bar,,45.27,,,,,,,,,,,,,,,",
      "Far Pin,bar,,43.65,-79.38,,,,,,,,,,,,,,",
      `Long Fact,bar,,,,,,,,,${"x".repeat(161)},,,,,,,,`,
      "Bad Source,bar,,,,,,,,,,,Label only,not-a-link,,,,,",
      ",bar,,,,,,,,,,,,,,,,,",
    ].join("\n");
    const result = checkCsv(text, { allowTestNames: true });
    const errs = Object.fromEntries(result.rows.map((r) => [r.line, r.errors.join(" | ")]));
    expect(errs[2]).toBe("");
    expect(errs[3]).toMatch(/Category must be one of/);
    expect(errs[4]).toMatch(/Year opened is after year closed/);
    expect(errs[5]).toMatch(/Era must be blank or one of/);
    expect(errs[5]).toMatch(/Difficulty must be 1, 2 or 3/);
    expect(errs[6]).toMatch(/both latitude and longitude/);
    expect(errs[7]).toMatch(/outside the Saint John map area/);
    expect(errs[8]).toMatch(/Fact: use 160 characters or fewer/);
    expect(errs[9]).toMatch(/full web address/);
    expect(errs[10]).toMatch(/Name is required/);
    expect(result.rows.filter((r) => r.place).map((r) => r.name)).toEqual(["Good Place"]);
  });

  it("ignores the starter sheet's extra columns and lists them", () => {
    const text = `verified_by_mike,import_check,${header},checked_from\nFALSE,needs pin,Taco Spot,restaurant,96 Germain St,,,,Uptown,1994,2020,2000s,A fact.,2,,,,,,,,article read`;
    const result = checkCsv(text, { allowTestNames: false });
    expect(result.ignoredColumns).toEqual(["verified_by_mike", "import_check", "checked_from"]);
    expect(result.rows[0].place).toMatchObject({ name: "Taco Spot", addressText: "96 Germain St", neighbourhood: "Uptown" });
  });

  it("refuses TEST: rows outside development, and flags repeated names", () => {
    const text = `${header}\nTEST: Nope,bar,,,,,,,,,,,,,,,,,\nTwice,bar,,,,,,,,,,,,,,,,,\ntwice,bar,,,,,,,,,,,,,,,,,`;
    const result = checkCsv(text, { allowTestNames: false });
    expect(result.rows[0].errors).toContain("TEST: names can't go into this database.");
    expect(result.rows[2].errors[0]).toMatch(/^Same name as line 3 in this file\./);
    expect(result.rows[2].place).toBeNull();
    expect(result.rows[1].place).not.toBeNull();
  });

  it("needs name and category columns", () => {
    expect(checkCsv("title,kind\nA,b", { allowTestNames: true }).fileErrors).toEqual([
      'The header row needs a "name" column.',
      'The header row needs a "category" column.',
    ]);
    expect(checkCsv("", { allowTestNames: true }).fileErrors).toEqual(["The file is empty."]);
  });

  it("exports rows that import back unchanged", () => {
    const text = readFileSync(join(__dirname, "..", "..", "..", "samples", "places-sample.csv"), "utf8");
    const places = checkCsv(text, { allowTestNames: true }).rows.map((r) => r.place!);
    const exported = toCsv([[...CSV_COLUMNS], ...places.map(placeToCsvRow)]);
    const again = checkCsv(exported, { allowTestNames: true }).rows.map((r) => r.place);
    expect(again).toEqual(places);
  });
});
