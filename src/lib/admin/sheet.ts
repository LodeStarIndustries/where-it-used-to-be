// Reads a Google Sheet tab as CSV. The sheet must be shared as "Anyone with the
// link can view". We only ever build the export URL ourselves from the sheet's
// id and tab number, so a pasted link can't make the server fetch anything else.

export class SheetError extends Error {}

const SHEET_PATH = /^\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})(?:\/|$)/;
const MAX_BYTES = 2_000_000;

/** The CSV export URL for a Google Sheets link, or a SheetError explaining what's wrong with it. */
export function sheetCsvUrl(link: string): string {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    throw new SheetError("That doesn't look like a link. Copy it from the browser's address bar while the sheet is open.");
  }
  const id = url.hostname === "docs.google.com" ? SHEET_PATH.exec(url.pathname)?.[1] : undefined;
  if (url.protocol !== "https:" || !id) {
    throw new SheetError("That isn't a Google Sheets link. It should start with https://docs.google.com/spreadsheets/d/");
  }
  // The tab: #gid=123 in the address bar, or ?gid=123. Without one, Google uses the first tab.
  const gid = /(?:^|[#&?])gid=(\d+)/.exec(url.hash)?.[1] ?? url.searchParams.get("gid");
  const out = new URL(`https://docs.google.com/spreadsheets/d/${id}/export`);
  out.searchParams.set("format", "csv");
  if (gid && /^\d+$/.test(gid)) out.searchParams.set("gid", gid);
  return out.toString();
}

/** Downloads the tab as CSV text. */
export async function fetchSheetCsv(link: string): Promise<string> {
  const csvUrl = sheetCsvUrl(link);
  let res: Response;
  try {
    res = await fetch(csvUrl, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new SheetError("Couldn't reach Google Sheets. Try again in a moment.");
  }
  const type = res.headers.get("content-type") ?? "";
  // A private sheet answers with a Google sign-in page (HTML) or a 401/403, not CSV.
  if (res.status === 401 || res.status === 403 || type.includes("text/html")) {
    throw new SheetError(
      'Google wouldn\'t share that sheet. In the sheet, choose Share → General access → "Anyone with the link" (Viewer), then try again.',
    );
  }
  if (res.status === 404 || res.status === 400) {
    throw new SheetError("Google couldn't find that sheet or tab. Check the link, and open the right tab before copying it.");
  }
  if (!res.ok) throw new SheetError(`Google Sheets answered with an error (${res.status}). Try again in a moment.`);
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new SheetError("That tab is too big to import in one go.");
  return text;
}
