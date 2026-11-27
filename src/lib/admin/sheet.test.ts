import { describe, expect, it } from "vitest";
import { SheetError, sheetCsvUrl } from "./sheet";

const ID = "1PQA4XwMNy87e7oYcnU1csQ0mpvl_jYZ7uJBV60dTEST";

describe("sheetCsvUrl", () => {
  it("builds the CSV export link, keeping the tab from the address bar", () => {
    expect(sheetCsvUrl(`https://docs.google.com/spreadsheets/d/${ID}/edit#gid=12345`)).toBe(
      `https://docs.google.com/spreadsheets/d/${ID}/export?format=csv&gid=12345`,
    );
    expect(sheetCsvUrl(`https://docs.google.com/spreadsheets/d/${ID}/edit?usp=sharing&gid=7#gid=7`)).toBe(
      `https://docs.google.com/spreadsheets/d/${ID}/export?format=csv&gid=7`,
    );
    expect(sheetCsvUrl(`  https://docs.google.com/spreadsheets/d/${ID}  `)).toBe(
      `https://docs.google.com/spreadsheets/d/${ID}/export?format=csv`,
    );
  });

  it("refuses anything that isn't a Google Sheets link", () => {
    for (const bad of [
      "not a link",
      `http://docs.google.com/spreadsheets/d/${ID}/edit`,
      `https://docs.google.com.evil.example/spreadsheets/d/${ID}/edit`,
      `https://evil.example/spreadsheets/d/${ID}`,
      "https://docs.google.com/document/d/abc/edit",
      "https://docs.google.com/spreadsheets/d/short/edit",
    ]) {
      expect(() => sheetCsvUrl(bad), bad).toThrow(SheetError);
    }
  });

  it("ignores a tab number that isn't a number", () => {
    expect(sheetCsvUrl(`https://docs.google.com/spreadsheets/d/${ID}/edit#gid=1;x`)).toBe(
      `https://docs.google.com/spreadsheets/d/${ID}/export?format=csv&gid=1`,
    );
  });
});
