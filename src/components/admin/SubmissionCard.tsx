"use client";

import { useState, useTransition } from "react";
import { approveSubmissionAction, duplicateSubmissionAction, rejectSubmissionAction, type ActionResult } from "@/lib/admin/actions";
import type { NearbySite } from "@/lib/admin/data";
import type { SubmissionDetail } from "@/lib/submissions/data";
import { categoryLabel } from "@/components/game/labels";
import dynamic from "next/dynamic";
// The map (MapLibre, about 1 MB) loads only when this screen shows it, not when a link to the page is prefetched.
const PinMap = dynamic(() => import("@/components/map/PinMap").then((m) => m.PinMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-map-land" aria-hidden="true" />,
});
import { adminButton, adminButtonDanger, adminButtonSecondary, adminInput, adminLabel, adminTextarea } from "./ui";

export function SubmissionCard(props: {
  s: SubmissionDetail;
  photoUrl: string | null;
  nearby: NearbySite[];
  places: { id: string; name: string }[];
}) {
  const { s, photoUrl, nearby, places } = props;
  const [showMap, setShowMap] = useState(false);
  const [mode, setMode] = useState<"approve" | "reject" | "duplicate" | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  const submit = (action: (fd: FormData) => Promise<ActionResult>) => (fd: FormData) =>
    start(async () => setResult(await action(fd)));

  if (result?.ok) {
    return (
      <article className="rounded-card bg-surface p-4 text-[14px] text-body shadow-card" role="status">
        <strong className="text-ink">{s.businessName}</strong>: {result.message}
      </article>
    );
  }

  return (
    <article className="rounded-card bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[18px] font-bold text-ink">{s.businessName}</h2>
          <p className="text-[13px] text-secondary">
            {categoryLabel[s.category]} · from {s.submittedBy} ·{" "}
            {new Date(s.createdAt).toLocaleDateString("en-CA", { timeZone: "America/Moncton", month: "short", day: "numeric" })}
          </p>
        </div>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-1 text-[14px] sm:grid-cols-2">
        {[
          ["Address", s.addressText],
          ["Now", s.currentUse],
          ["Open", s.yearsText],
          ["Decade", s.era],
          ["Pin", `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="w-16 shrink-0 text-secondary">{k}</dt>
            <dd className="text-ink">{v || "—"}</dd>
          </div>
        ))}
      </dl>
      {s.memory && <p className="mt-3 rounded-button bg-background p-3 text-[14px] text-body">&ldquo;{s.memory}&rdquo;</p>}
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL from private storage
        <img src={photoUrl} alt={`Photo sent with ${s.businessName}`} className="mt-3 max-h-56 rounded-card object-cover" />
      )}
      {nearby.length > 0 && (
        <p className="mt-3 rounded-button bg-[#E1ECF4] p-2 text-[13px] text-ink">
          Within 30 m of: {nearby.map((n) => `${n.placeNames.join(", ") || "an empty site"} (${n.distanceM} m)`).join("; ")}
        </p>
      )}

      <div className="mt-3">
        {showMap ? (
          <PinMap variant="admin" value={{ lat: s.lat, lng: s.lng }} onChange={() => {}} className="h-64" label={`Where ${s.businessName} was`} />
        ) : (
          <button type="button" className="text-[14px] font-semibold text-ink underline" onClick={() => setShowMap(true)}>
            Show on map
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={adminButton} onClick={() => setMode("approve")} disabled={pending}>
          Approve
        </button>
        <button type="button" className={adminButtonSecondary} onClick={() => setMode("duplicate")} disabled={pending}>
          Duplicate
        </button>
        <button type="button" className={adminButtonDanger} onClick={() => setMode("reject")} disabled={pending}>
          Reject
        </button>
      </div>

      {mode === "approve" && (
        <form action={submit(approveSubmissionAction)} className="mt-3 space-y-3 rounded-button border border-divider p-3">
          <input type="hidden" name="id" value={s.id} />
          <fieldset>
            <legend className={adminLabel}>Which site?</legend>
            <label className="mt-1 flex items-center gap-2 text-[14px]">
              <input type="radio" name="siteId" value="" defaultChecked className="accent-ink" /> A new site at the player&apos;s pin
            </label>
            {nearby.map((n) => (
              <label key={n.siteId} className="mt-1 flex items-center gap-2 text-[14px]">
                <input type="radio" name="siteId" value={n.siteId} className="accent-ink" /> Share the site with{" "}
                {n.placeNames.join(", ") || "an empty site"} ({n.distanceM} m away)
              </label>
            ))}
          </fieldset>
          <label className="block">
            <span className={adminLabel}>Note (optional, admins only)</span>
            <input name="note" maxLength={1000} className={adminInput} />
          </label>
          <p className="text-[13px] text-secondary">
            Creates a draft with the name, category, pin, address, what&apos;s there now, decade and photo. The years and the
            memory go into its notes. Then it opens the draft for you to finish.
          </p>
          <button type="submit" className={adminButton} disabled={pending}>
            {pending ? "Creating…" : "Create the draft"}
          </button>
        </form>
      )}
      {mode === "duplicate" && (
        <form action={submit(duplicateSubmissionAction)} className="mt-3 space-y-3 rounded-button border border-divider p-3">
          <input type="hidden" name="id" value={s.id} />
          <label className="block">
            <span className={adminLabel}>It duplicates</span>
            <select name="placeId" className={adminInput} defaultValue="">
              <option value="" disabled>
                Choose the existing place
              </option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={adminLabel}>Note (optional, admins only)</span>
            <input name="note" maxLength={1000} className={adminInput} />
          </label>
          <button type="submit" className={adminButton} disabled={pending}>
            Mark as duplicate
          </button>
        </form>
      )}
      {mode === "reject" && (
        <form action={submit(rejectSubmissionAction)} className="mt-3 space-y-3 rounded-button border border-divider p-3">
          <input type="hidden" name="id" value={s.id} />
          <label className="block">
            <span className={adminLabel}>Why? (optional, admins only)</span>
            <textarea name="note" maxLength={1000} rows={2} className={adminTextarea} placeholder="e.g. a private home, or can't confirm it existed" />
          </label>
          <button type="submit" className={adminButtonDanger} disabled={pending}>
            Reject
          </button>
        </form>
      )}
      {result && !result.ok && (
        <p className="mt-2 text-[14px] text-[#8F2F1C]" role="alert">
          {result.errors.join(" ")}
        </p>
      )}
    </article>
  );
}
