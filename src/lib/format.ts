/** "Fri, Dec 5" for a YYYY-MM-DD puzzle date (no time zone shift). */
export function formatShortDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${isoDate}T12:00:00Z`),
  );
}
