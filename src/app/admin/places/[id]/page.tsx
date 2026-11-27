import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { getPlace, pinnedSites } from "@/lib/admin/data";
import { requireAdminPage } from "@/lib/admin/guard";
import { PlaceEditor } from "@/components/admin/PlaceEditor";
import { PlacePhoto } from "@/components/admin/PlacePhoto";
import { signedPhotoUrl } from "@/lib/photos";

async function EditPlace({ params, searchParams }: PageProps<"/admin/places/[id]">) {
  const { id } = await params;
  await requireAdminPage(`/admin/places/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const [place, sites, sp] = await Promise.all([getPlace(id), pinnedSites(), searchParams]);
  if (!place) notFound();
  const photoUrl = await signedPhotoUrl(place.photoPath);
  return (
    <>
      <h1 className="mb-1 text-[26px] font-bold text-ink">{place.name}</h1>
      {sp.created && (
        <p className="mb-3 text-[14px] text-[#1F5E36]" role="status">
          Draft created.
        </p>
      )}
      <PlaceEditor place={place} otherSites={sites} />
      <div className="mt-6 max-w-[380px]">
        <PlacePhoto placeId={place.id} photoUrl={photoUrl} />
      </div>
    </>
  );
}

export default function EditPlacePage(props: PageProps<"/admin/places/[id]">) {
  return (
    <div>
      <Link href="/admin/places" className="text-[14px] font-semibold text-ink hover:underline">
        ← Places
      </Link>
      <div className="mt-3">
        <Suspense fallback={<p className="label-caps text-secondary">Loading…</p>}>
          <EditPlace {...props} />
        </Suspense>
      </div>
    </div>
  );
}
