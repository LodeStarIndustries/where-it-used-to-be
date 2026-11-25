import { describe, expect, it } from "vitest";
import { daysBetween, puzzleDateFor, puzzleNumberFor } from "./puzzle-date";

// Atlantic Time: AST is UTC-4, ADT is UTC-3.
describe("puzzleDateFor (America/Moncton)", () => {
  it("rolls over at local midnight in winter (AST, UTC-4)", () => {
    expect(puzzleDateFor(new Date("2026-12-18T03:59:59Z"))).toBe("2026-12-17");
    expect(puzzleDateFor(new Date("2026-12-18T04:00:00Z"))).toBe("2026-12-18");
  });

  it("rolls over at local midnight in summer (ADT, UTC-3)", () => {
    expect(puzzleDateFor(new Date("2027-07-02T02:59:59Z"))).toBe("2027-07-01");
    expect(puzzleDateFor(new Date("2027-07-02T03:00:00Z"))).toBe("2027-07-02");
  });

  it("handles the spring-forward day (2027-03-14, clocks jump 2:00 to 3:00)", () => {
    // Midnight starting the 14th is still AST (UTC-4).
    expect(puzzleDateFor(new Date("2027-03-14T03:59:59Z"))).toBe("2027-03-13");
    expect(puzzleDateFor(new Date("2027-03-14T04:00:00Z"))).toBe("2027-03-14");
    // Midnight ending the 14th is ADT (UTC-3).
    expect(puzzleDateFor(new Date("2027-03-15T02:59:59Z"))).toBe("2027-03-14");
    expect(puzzleDateFor(new Date("2027-03-15T03:00:00Z"))).toBe("2027-03-15");
  });

  it("handles the fall-back day (2026-11-01, clocks fall 2:00 to 1:00)", () => {
    // Midnight starting the 1st is still ADT (UTC-3).
    expect(puzzleDateFor(new Date("2026-11-01T02:59:59Z"))).toBe("2026-10-31");
    expect(puzzleDateFor(new Date("2026-11-01T03:00:00Z"))).toBe("2026-11-01");
    // Midnight ending the 1st is AST (UTC-4).
    expect(puzzleDateFor(new Date("2026-11-02T03:59:59Z"))).toBe("2026-11-01");
    expect(puzzleDateFor(new Date("2026-11-02T04:00:00Z"))).toBe("2026-11-02");
  });
});

describe("puzzle numbers", () => {
  it("counts whole calendar days across a DST change", () => {
    expect(daysBetween("2027-03-13", "2027-03-15")).toBe(2);
  });

  it("is #1 on launch day", () => {
    expect(puzzleNumberFor("2026-12-17")).toBe(1);
    expect(puzzleNumberFor("2026-12-18")).toBe(2);
    expect(puzzleNumberFor("2027-12-17")).toBe(366);
  });
});
