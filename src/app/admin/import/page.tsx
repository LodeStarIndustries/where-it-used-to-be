import { Suspense } from "react";
import { requireAdminPage } from "@/lib/admin/guard";
import { CSV_COLUMNS } from "@/lib/admin/csv";
import { ImportTool } from "@/components/admin/ImportTool";
import { AdminCard, adminButtonSecondary } from "@/components/admin/ui";

async function Import() {
  await requireAdminPage("/admin/import");
  return (
    <div className="space-y-6">
      <h1 className="text-[26px] font-bold text-ink">Import &amp; export</h1>
      <AdminCard title="Import a CSV">
        <p className="mb-4 text-[14px] text-body">
          Every row becomes a <strong>draft</strong>. Rows without coordinates are flagged &ldquo;needs pin&rdquo; for you
          to place on the map; addresses are never looked up automatically. You see a full check of every row first, and
          nothing is saved until you press Import. Extra columns, like the starter sheet&apos;s{" "}
          <code>verified_by_mike</code>, are ignored.
        </p>
        <ImportTool />
      </AdminCard>
      <AdminCard title="Export">
        <p className="mb-3 text-[14px] text-body">
          Downloads every place (all statuses) in the same columns as the import, so you can edit it in a spreadsheet.
          Importing it again adds new drafts; it doesn&apos;t update existing places.
        </p>
        <a href="/admin/export" className={adminButtonSecondary} download>
          Download places.csv
        </a>
      </AdminCard>
      <AdminCard title="Columns">
        <p className="text-[13px] text-body">
          <code className="break-words">{CSV_COLUMNS.join(", ")}</code>
        </p>
        <p className="mt-2 text-[13px] text-secondary">
          Only name and category are required. A sample with three TEST: rows is in the repo at{" "}
          <code>samples/places-sample.csv</code>.
        </p>
      </AdminCard>
    </div>
  );
}

export default function ImportPage() {
  return (
    <Suspense fallback={<p className="label-caps text-secondary">Loading…</p>}>
      <Import />
    </Suspense>
  );
}
