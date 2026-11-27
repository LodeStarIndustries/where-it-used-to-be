// The rules for a place and its site, shared by the admin editor and the CSV
// import so both check exactly the same things. Pure: safe on server and client.
import { z } from "zod";
import { categories, eras, game, type Category, type Era } from "@config/game";

export interface SourceInput {
  label: string;
  url: string;
}

export interface PlaceInput {
  name: string;
  category: Category;
  addressText: string | null;
  lat: number | null;
  lng: number | null;
  currentUse: string | null;
  neighbourhood: string | null;
  yearOpened: number | null;
  yearClosed: number | null;
  era: Era | null;
  fact: string | null;
  difficulty: 1 | 2 | 3 | null;
  sources: SourceInput[];
  notes: string | null;
}

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const text = (max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v),
    z.string().max(max, `${label}: use ${max} characters or fewer`).nullable(),
  );
const year = (label: string) =>
  z.preprocess(
    (v) => (blankToNull(v) === null ? null : typeof v === "string" ? Number(v.trim()) : v),
    z
      .number({ error: `${label}: use a four-digit year` })
      .int(`${label}: use a four-digit year`)
      .min(1700, `${label}: use a year from 1700 on`)
      .max(2100, `${label}: use a four-digit year`)
      .nullable(),
  );
const coord = (label: string, min: number, max: number) =>
  z.preprocess(
    (v) => (blankToNull(v) === null ? null : typeof v === "string" ? Number(v.trim()) : v),
    z.number({ error: `${label}: use decimal degrees` }).min(min).max(max).nullable(),
  );

export const sourceSchema = z.object({
  label: z.string().trim().min(1, "Each source needs a label").max(160, "Source label: 160 characters or fewer"),
  url: z
    .string()
    .trim()
    .url("Each source needs a full web address (https://…)")
    .refine((u) => /^https?:\/\//i.test(u), "Source links must start with http:// or https://"),
});

export const placeSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120, "Name: 120 characters or fewer"),
    category: z.enum(categories as [Category, ...Category[]], {
      error: `Category must be one of: ${categories.join(", ")}`,
    }),
    addressText: text(200, "Address"),
    lat: coord("Latitude", -90, 90),
    lng: coord("Longitude", -180, 180),
    currentUse: text(120, "What's there now"),
    neighbourhood: text(80, "Neighbourhood"),
    yearOpened: year("Year opened"),
    yearClosed: year("Year closed"),
    era: z.preprocess(
      blankToNull,
      z.enum(eras as [Era, ...Era[]], { error: `Era must be blank or one of: ${eras.join(", ")}` }).nullable(),
    ),
    fact: text(160, "Fact"),
    difficulty: z.preprocess(
      (v) => (blankToNull(v) === null ? null : typeof v === "string" ? Number(v.trim()) : v),
      z.union([z.literal(1), z.literal(2), z.literal(3)], { error: "Difficulty must be 1, 2 or 3" }).nullable(),
    ),
    sources: z.array(sourceSchema).max(10, "Up to 10 sources"),
    notes: text(2000, "Notes"),
  })
  .superRefine((p, ctx) => {
    if ((p.lat === null) !== (p.lng === null)) {
      ctx.addIssue({ code: "custom", message: "Give both latitude and longitude, or neither" });
    }
    if (p.lat !== null && p.lng !== null) {
      const [[west, south], [east, north]] = game.map.bounds;
      if (p.lat < south || p.lat > north || p.lng < west || p.lng > east) {
        ctx.addIssue({ code: "custom", message: "The pin is outside the Saint John map area" });
      }
    }
    if (p.yearOpened !== null && p.yearClosed !== null && p.yearOpened > p.yearClosed) {
      ctx.addIssue({ code: "custom", message: "Year opened is after year closed" });
    }
  });

export type PlaceCheck = { ok: true; place: PlaceInput } | { ok: false; errors: string[] };

export function checkPlace(raw: unknown): PlaceCheck {
  const parsed = placeSchema.safeParse(raw);
  if (parsed.success) return { ok: true, place: parsed.data as PlaceInput };
  return { ok: false, errors: [...new Set(parsed.error.issues.map((i) => i.message))] };
}

/** What still blocks a place from going live, in plain words. Empty when it can. */
export function liveBlockers(p: {
  lat: number | null;
  difficulty: number | null;
  verifiedAt: string | null;
}): string[] {
  const out: string[] = [];
  if (p.lat === null) out.push("needs a pin on the map");
  if (p.verifiedAt === null) out.push("needs to be marked verified");
  if (p.difficulty === null) out.push("needs a difficulty");
  return out;
}
