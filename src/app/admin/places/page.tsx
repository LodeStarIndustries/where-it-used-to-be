import Link from "next/link";
import { Suspense } from "react";
import { categories, eras, type Category, type Era } from "@config/game";
import { PAGE_SIZE, listPlaces, type PlaceFilters, type PlaceStatus } from "@/lib/admin/data";
import { requireAdminPage } from "@/lib/admin/guard";
import { categoryLabel } from "@/components/game/labels";
import { AdminCard, Pill, adminButton, adminButtonSecondary, adminInput, adminLabel } from "@/components/admin/ui";

type Search = Awaited<PageProps<"/admin/places">["searchParams"]>;
const one = (v: Search[string]) => (Array.isArray(v) ? v[0] : v);

function filtersFrom(sp: Search): PlaceFilters {
  const status = one(sp.status);
  const era = one(sp.era);
  const category = one(sp.category);
  return {
    q: one(sp.q)?.trim() || undefined,
    status: status === "draft" || status === "live" || status === "retired" ? (status as PlaceStatus) : undefined,
    era: era === "none" ? "none" : eras.includes(era as Era) ? (era as Era) : undefined,
    category: categories.includes(category as Category) ? (category as Category) : undefined,
    needsPin: one(sp.needsPin) === "1",
    missingFact: one(sp.missingFact) === "1",
    missingSource: one(sp.missingSource) === "1",
    ready: one(sp.ready) === "1",
    page: Number(one(sp.page) ?? 0) || 0,
  };
}

function pageHref(sp: Search, page: number) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (k !== "page" && typeof v === "string" && v) params.set(k, v);
  if (page) params.set("page", String(page));
  return `/admin/places?${params}`;
}

async function Places({ searchParams }: { searchParams: PageProps<"/admin/places">["searchParams"] }) {
  await requireAdminPage("/admin/places");
  const sp = await searchParams;
  const f = filtersFrom(sp);
  const { rows, total } = await listPlaces(f);
  const page = f.page ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[26px] font-bold text-ink">Places</h1>
        <Link href="/admin/places/new" className={adminButton}>
          Add a place
        </Link>
      </div>
      {one(sp.deleted) && (
        <p className="text-[14px] text-body" role="status">
          Draft deleted.
        </p>
      )}

      <AdminCard>
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" method="get">
          <label className="lg:col-span-2">
            <span className={adminLabel}>Search names</span>
            <input name="q" defaultValue={f.q} className={adminInput} placeholder="e.g. Zellers" />
          </label>
          <label>
            <span className={adminLabel}>Status</span>
            <select name="status" defaultValue={f.status ?? ""} className={adminInput}>
              <option value="">Any</option>
              <option value="draft">Draft</option>
              <option value="live">Live</option>
              <option value="retired">Retired</option>
            </select>
          </label>
          <label>
            <span className={adminLabel}>Era</span>
            <select name="era" defaultValue={f.era ?? ""} className={adminInput}>
              <option value="">Any</option>
              {eras.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
              <option value="none">None (fallback card)</option>
            </select>
          </label>
          <label>
            <span className={adminLabel}>Category</span>
            <select name="category" defaultValue={f.category ?? ""} className={adminInput}>
              <option value="">Any</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel[c]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className={adminButton}>
              Filter
            </button>
            <Link href="/admin/places" className={adminButtonSecondary}>
              Clear
            </Link>
          </div>
          <fieldset className="flex flex-wrap gap-x-5 gap-y-2 sm:col-span-2 lg:col-span-6">
            <legend className="sr-only">Show only</legend>
            {[
              ["needsPin", "Needs a pin", f.needsPin],
              ["missingFact", "Missing fact", f.missingFact],
              ["missingSource", "Missing source", f.missingSource],
              ["ready", "Ready to go live", f.ready],
            ].map(([name, label, on]) => (
              <label key={String(name)} className="flex items-center gap-2 text-[14px] text-ink">
                <input type="checkbox" name={String(name)} value="1" defaultChecked={Boolean(on)} className="size-4 accent-ink" />
                {label}
              </label>
            ))}
          </fieldset>
        </form>
      </AdminCard>

      <p className="text-[13px] text-secondary">
        {total} {total === 1 ? "place" : "places"}
        {pages > 1 && ` · page ${page + 1} of ${pages}`}
      </p>

      <div className="overflow-x-auto rounded-card bg-surface shadow-card">
        <table className="w-full min-w-[720px] text-left text-[14px]">
          <thead className="border-b border-divider text-[12px] uppercase tracking-wide text-secondary">
            <tr>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Category</th>
              <th className="px-3 py-2 font-semibold">Era</th>
              <th className="px-3 py-2 font-semibold">Checks</th>
              <th className="px-3 py-2 font-semibold">Last used</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider-soft">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-background">
                <td className="px-3 py-2">
                  <Link href={`/admin/places/${r.id}`} className="font-semibold text-ink underline-offset-2 hover:underline">
                    {r.name}
                  </Link>
                  <p className="text-[12px] text-secondary">{[r.addressText, r.neighbourhood].filter(Boolean).join(" · ")}</p>
                </td>
                <td className="px-3 py-2">
                  <Pill tone={r.status}>{r.status}</Pill>
                </td>
                <td className="px-3 py-2 text-body">{categoryLabel[r.category]}</td>
                <td className="px-3 py-2 text-body">{r.era ?? "—"}</td>
                <td className="px-3 py-2">
                  <span className="flex flex-wrap gap-1">
                    {!r.hasPin && <Pill tone="warn">needs pin</Pill>}
                    {!r.verified && <Pill tone="info">unverified</Pill>}
                    {r.difficulty === null && <Pill tone="info">no difficulty</Pill>}
                    {!r.hasFact && <Pill tone="info">no fact</Pill>}
                    {r.sourceCount === 0 && <Pill tone="info">no source</Pill>}
                  </span>
                </td>
                <td className="px-3 py-2 text-body">{r.lastUsedOn ?? "Never"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-body">
                  No places match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex gap-2">
          {page > 0 && (
            <Link href={pageHref(sp, page - 1)} className={adminButtonSecondary}>
              ← Previous
            </Link>
          )}
          {page + 1 < pages && (
            <Link href={pageHref(sp, page + 1)} className={adminButtonSecondary}>
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPlacesPage(props: PageProps<"/admin/places">) {
  return (
    <Suspense fallback={<p className="label-caps text-secondary">Loading…</p>}>
      <Places searchParams={props.searchParams} />
    </Suspense>
  );
}
