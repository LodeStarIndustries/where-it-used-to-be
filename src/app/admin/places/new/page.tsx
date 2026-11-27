import Link from "next/link";
import { Suspense } from "react";
import { pinnedSites } from "@/lib/admin/data";
import { requireAdminPage } from "@/lib/admin/guard";
import { PlaceEditor } from "@/components/admin/PlaceEditor";

async function NewPlace() {
  await requireAdminPage("/admin/places/new");
  const sites = await pinnedSites();
  return <PlaceEditor place={null} otherSites={sites} />;
}

export default function NewPlacePage() {
  return (
    <div>
      <Link href="/admin/places" className="text-[14px] font-semibold text-ink hover:underline">
        ← Places
      </Link>
      <h1 className="mb-3 mt-3 text-[26px] font-bold text-ink">Add a place</h1>
      <Suspense fallback={<p className="label-caps text-secondary">Loading…</p>}>
        <NewPlace />
      </Suspense>
    </div>
  );
}
