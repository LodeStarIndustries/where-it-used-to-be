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
      <AdminCard title="Import from the master sheet">
        <p className="mb-4 text-[14px] text-body">
          Run this whenever the sheet changes. Rows are matched to places by name (capitals don&apos;t matter). New
          names become <strong>drafts</strong>; places already here get the sheet&apos;s changes, keeping their status.
          A blank cell never erases anything, so pins you dropped here stay when the sheet has no coordinates. Rows
          without a pin are flagged &ldquo;needs pin&rdquo;; addresses are never looked up automatically. You see every
          row first, and nothing is saved until you press the import button. Extra columns, like{" "}
          <code>verified_by_mike</code>, are ignored.
        </p>
        <ImportTool />
      </AdminCard>
      <AdminCard title="Export">
        <p className="mb-3 text-[14px] text-body">
          Downloads every place (all statuses) in the same columns as the import, including pins dropped here, so you
          can paste them back into the sheet.
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
          Only name and category are required, and each name must appear once. A sample with three TEST: rows is in the repo at{" "}
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
