import { describe, expect, it } from "vitest";
import { checkDisplayName, checkGroupName } from "./names";

const blocked = (name: string) => checkDisplayName(name).ok === false;

describe("display names", () => {
  it("accepts ordinary names and tidies spaces", () => {
    expect(checkDisplayName("  Pat   from  Uptown ")).toEqual({ ok: true, name: "Pat from Uptown" });
  });

  it("enforces 2 to 24 characters", () => {
    expect(blocked("P")).toBe(true);
    expect(blocked("x".repeat(25))).toBe(true);
    expect(blocked("x".repeat(24))).toBe(false);
  });

  it("blocks profanity, including common disguises", () => {
    for (const name of ["fuck", "Big Shit", "f4ck you", "s.h.i.t", "fuuuuck", "f-u-c-k", "ASSHOLE", "bitch99", "cunt"]) {
      expect(blocked(name), name).toBe(true);
    }
    expect(checkDisplayName("shithead")).toEqual({ ok: false, message: "That name isn't allowed. Try another." });
  });

  it("allows ordinary words and local names that contain rude letters", () => {
    for (const name of ["Scunthorpe", "Dickson", "Dickens", "Cockburn", "Hancock", "Cassandra", "Sussex Pat", "Shitake Fan", "Glasshouse", "Grape Escape", "Penistone"]) {
      expect(blocked(name), name).toBe(false);
    }
  });
});

describe("group names", () => {
  it("accepts ordinary names up to 40 characters", () => {
    expect(checkGroupName(" Book  club ")).toEqual({ ok: true, name: "Book club" });
    expect(checkGroupName("x".repeat(41)).ok).toBe(false);
  });

  it("blocks profanity, including disguises, but not ordinary words", () => {
    for (const name of ["Shit Crew", "f-u-c-k work", "B1tches"]) {
      expect(checkGroupName(name), name).toEqual({ ok: false, message: "That name isn't allowed. Try another." });
    }
    for (const name of ["Dickson Family", "Cockburn St Crew", "Scunthorpe Fans"]) {
      expect(checkGroupName(name).ok, name).toBe(true);
    }
  });
});
