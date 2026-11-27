import { connection } from "next/server";
import { allPlacesForExport } from "@/lib/admin/data";
import { NotAdminError, assertAdmin } from "@/lib/admin/guard";
import { CSV_COLUMNS, placeToCsvRow, toCsv } from "@/lib/admin/csv";
import { puzzleDateFor } from "@/lib/puzzle-date";

// Every place as a CSV in the import's columns, so the file round-trips.
export async function GET() {
  await connection();
  try {
    await assertAdmin();
  } catch (err) {
    if (err instanceof NotAdminError) return new Response("Not found", { status: 404 });
    throw err;
  }
  const places = await allPlacesForExport();
  // A BOM so Excel reads the file as UTF-8.
  const body = "﻿" + toCsv([[...CSV_COLUMNS], ...places.map(placeToCsvRow)]);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="where-it-used-to-be-places-${puzzleDateFor(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
