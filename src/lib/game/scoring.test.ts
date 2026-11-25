import { describe, expect, it } from "vitest";
import { distanceMeters, streetFromAddress } from "./geo";
import { formatDistance, namePoints, pinPoints, shareText, verdictFor } from "./scoring";

describe("pin scoring", () => {
  it.each([
    [0, 200],
    [50, 200],
    [275, 150], // halfway between 50 m and 500 m
    [500, 100],
    [2750, 50], // halfway between 500 m and 5 km
    [5000, 0],
    [6000, 0],
  ])("%i m scores %i", (meters, points) => {
    expect(pinPoints(meters)).toBe(points);
  });

  it("rounds to whole points and never goes up with distance", () => {
    let last = 200;
    for (let m = 0; m <= 6000; m += 7) {
      const p = pinPoints(m);
      expect(Number.isInteger(p)).toBe(true);
      expect(p).toBeLessThanOrEqual(last);
      last = p;
    }
  });

  it("scores bad input as 0", () => {
    expect(pinPoints(Number.NaN)).toBe(0);
    expect(pinPoints(-1)).toBe(0);
  });
});

describe("name scoring and verdicts", () => {
  it("is 200 or 0", () => {
    expect(namePoints(true)).toBe(200);
    expect(namePoints(false)).toBe(0);
  });

  it.each([
    [200, "lifer"],
    [180, "lifer"],
    [179, "knows"],
    [120, "knows"],
    [119, "closeish"],
    [60, "closeish"],
    [59, "away"],
    [1, "away"],
    [0, "who"],
  ])("%i points is %s", (points, key) => {
    expect(verdictFor(points).key).toBe(key);
  });
});

describe("share text", () => {
  it("matches the spec format", () => {
    expect(shareText(12, [200, 150, 90, 180, 40], "https://example.com")).toBe(
      "Where It Used To Be #12 · 660/1000\n🟩🟨🟧🟩🟥\nhttps://example.com",
    );
    expect(shareText(1, [0, 0, 0, 0, 0], "u")).toContain("⬛⬛⬛⬛⬛");
  });
});

describe("geometry", () => {
  it("measures great-circle distance", () => {
    // One thousandth of a degree of latitude is about 111 m.
    expect(distanceMeters({ lat: 45.27, lng: -66.06 }, { lat: 45.271, lng: -66.06 })).toBeCloseTo(111.2, 0);
    expect(distanceMeters({ lat: 45.27, lng: -66.06 }, { lat: 45.27, lng: -66.06 })).toBe(0);
  });

  it.each([
    ["5 Golden Grove Rd", "Golden Grove Rd"],
    ["96-100 Germain St", "Germain St"],
    ["12A King St", "King St"],
    ["Colton Brook Rd and Mackay Hwy", "Colton Brook Rd and Mackay Hwy"],
    ["", null],
    [null, null],
  ])("street of %s is %s", (address, street) => {
    expect(streetFromAddress(address)).toBe(street);
  });

  it("formats distances", () => {
    expect(formatDistance(35.4)).toBe("35 m");
    expect(formatDistance(1234)).toBe("1.2 km");
    expect(formatDistance(12_345)).toBe("12 km");
  });
});
