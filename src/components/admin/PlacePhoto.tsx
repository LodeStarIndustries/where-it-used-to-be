"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { removePlacePhotoAction, uploadPlacePhotoAction, type ActionResult } from "@/lib/admin/actions";
import { shrinkPhoto } from "@/lib/photo-client";
import { adminButton, adminButtonDanger } from "./ui";

export function PlacePhoto({ placeId, photoUrl }: { placeId: string; photoUrl: string | null }) {
  const router = useRouter();
  const [result, action, uploading] = useActionState(uploadPlacePhotoAction, null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [removed, setRemoved] = useState<ActionResult | null>(null);
  const [busy, start] = useTransition();
  useEffect(() => {
    if (result?.ok) router.refresh();
  }, [result, router]);

  return (
    <section className="space-y-3 rounded-card bg-surface p-4 shadow-card">
      <h2 className="text-[17px] font-bold text-ink">Photo</h2>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL from private storage
        <img src={photoUrl} alt="This place's photo" className="max-h-56 w-full rounded-card object-cover" />
      ) : (
        <p className="text-[14px] text-body">No photo.</p>
      )}
      <form
        action={(fd) => {
          if (photo) fd.set("photo", photo, "photo.jpg");
          action(fd);
        }}
        className="space-y-2"
      >
        <input type="hidden" name="placeId" value={placeId} />
        <input
          type="file"
          accept="image/jpeg,image/png"
          aria-label="Choose a photo"
          className="block w-full text-[13px] text-body file:mr-2 file:rounded-button file:border-0 file:bg-background file:px-3 file:py-1.5 file:font-semibold file:text-ink"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            setPhoto(f ? await shrinkPhoto(f) : null);
          }}
        />
        <label className="flex items-start gap-2 text-[13px] text-ink">
          <input type="checkbox" name="photoRights" className="mt-0.5 size-4 accent-ink" />
          I took this photo or have permission to use it.
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={adminButton} disabled={!photo || uploading}>
            {uploading ? "Uploading…" : photoUrl ? "Replace photo" : "Upload photo"}
          </button>
          {photoUrl && (
            <button
              type="button"
              className={adminButtonDanger}
              disabled={busy}
              onClick={() =>
                start(async () => {
                  const r = await removePlacePhotoAction(placeId);
                  setRemoved(r);
                  if (r.ok) router.refresh();
                })
              }
            >
              Remove
            </button>
          )}
        </div>
      </form>
      {[result, removed].map((r, i) =>
        r && !r.ok ? (
          <p key={i} className="text-[13px] text-[#8F2F1C]" role="alert">
            {r.errors.join(" ")}
          </p>
        ) : null,
      )}
      <p className="text-[12px] text-secondary">Location and camera details are removed. Photos aren&apos;t shown to players yet.</p>
    </section>
  );
}
