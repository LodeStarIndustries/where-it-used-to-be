"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { categories, eras } from "@config/game";
import { submitSuggestionAction, type SuggestState } from "@/lib/submissions/actions";
import { shrinkPhoto } from "@/lib/photo-client";
import { categoryLabel } from "@/components/game/labels";
import { PinMap, type LatLngValue } from "@/components/map/PinMap";
import { inputClass, primaryButtonClass } from "@/components/ui/Page";

const label = "block text-[14px] font-semibold text-ink";
const hint = "mt-1 text-[13px] text-secondary";
const textarea =
  "mt-1 block w-full rounded-button border border-divider bg-surface px-4 py-3 text-[16px] text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20";

export function SuggestForm() {
  const [state, formAction, pending] = useActionState<SuggestState, FormData>(submitSuggestionAction, { status: "idle" });
  const [pin, setPin] = useState<LatLngValue | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [memory, setMemory] = useState("");

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function pickPhoto(file: File | undefined) {
    setPhotoNote(null);
    if (!file) return;
    if (!/^image\/(jpeg|png)$/.test(file.type)) {
      setPhotoNote("Use a JPG or PNG photo.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoNote("Photos can be up to 5 MB.");
      return;
    }
    const small = await shrinkPhoto(file);
    setPhoto(small);
    setPreview(URL.createObjectURL(small));
  }

  return (
    <form
      // Submitting through onSubmit (not the action prop) keeps what the player typed if the server sends back an error.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (photo) fd.set("photo", photo, "photo.jpg");
        startTransition(() => formAction(fd));
      }}
      className="mt-6 space-y-6"
      noValidate
    >
      <section className="space-y-4 rounded-card bg-surface p-4 shadow-card">
        <label className="block">
          <span className={label}>Business name</span>
          <input name="businessName" required maxLength={120} className={inputClass} autoComplete="off" />
        </label>
        <label className="block">
          <span className={label}>Category</span>
          <select name="category" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Choose one
            </option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryLabel[c]}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className={label} id="pin-label">
            Where it was
          </span>
          <p className={hint}>Tap the map to drop a pin. Drag it to adjust. Zoom in to get it on the right building.</p>
          <div className="mt-2">
            <PinMap variant="player" value={pin} onChange={setPin} className="h-72" label="Map for where it was" />
          </div>
          <input type="hidden" name="lat" value={pin?.lat ?? ""} />
          <input type="hidden" name="lng" value={pin?.lng ?? ""} />
          {!pin && <p className="mt-1 text-[13px] text-secondary">No pin yet.</p>}
        </div>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="notResidence" required className="mt-0.5 size-5 shrink-0 accent-ink" />
          <span className="text-[15px] text-ink">It was a business or public place, not someone&apos;s home.</span>
        </label>
      </section>

      <section className="space-y-4 rounded-card bg-surface p-4 shadow-card">
        <p className="label-caps text-secondary">Optional, but it helps</p>
        <label className="block">
          <span className={label}>Address or nearest intersection</span>
          <input name="addressText" maxLength={200} className={inputClass} />
        </label>
        <label className="block">
          <span className={label}>What&apos;s there now</span>
          <input name="currentUse" maxLength={120} className={inputClass} placeholder="e.g. a parking lot" />
        </label>
        <label className="block">
          <span className={label}>Roughly when it was open</span>
          <input name="yearsText" maxLength={60} className={inputClass} placeholder="e.g. late 80s to 2005" />
        </label>
        <label className="block">
          <span className={label}>The decade you remember it from</span>
          <select name="era" defaultValue="" className={inputClass}>
            <option value="">Not sure</option>
            {eras.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={label}>
            A memory <span className="font-normal text-secondary">· {memory.length}/500</span>
          </span>
          <textarea
            name="memory"
            maxLength={500}
            rows={4}
            value={memory}
            onChange={(e) => setMemory(e.target.value)}
            className={textarea}
            placeholder="What do you remember about it?"
          />
          <span className={`${hint} block`}>Please don&apos;t name private people.</span>
        </label>
        <div>
          <label className="block">
            <span className={label}>A photo</span>
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="mt-1 block w-full text-[15px] text-body file:mr-3 file:rounded-button file:border-0 file:bg-background file:px-4 file:py-2 file:font-semibold file:text-ink"
              onChange={(e) => pickPhoto(e.target.files?.[0])}
            />
          </label>
          <p className={hint}>JPG or PNG, up to 5 MB. We remove location and camera details from photos.</p>
          {photoNote && (
            <p className="mt-1 text-[14px] text-accent" role="alert">
              {photoNote}
            </p>
          )}
          {preview && (
            <div className="mt-3 space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen file */}
              <img src={preview} alt="The photo you chose" className="max-h-48 rounded-card object-cover" />
              <label className="flex items-start gap-3">
                <input type="checkbox" name="photoRights" className="mt-0.5 size-5 shrink-0 accent-ink" />
                <span className="text-[15px] text-ink">I took this photo or have permission to share it.</span>
              </label>
              <button
                type="button"
                className="text-[14px] font-semibold text-accent underline"
                onClick={() => {
                  setPhoto(null);
                  setPreview(null);
                }}
              >
                Remove photo
              </button>
            </div>
          )}
        </div>
      </section>

      {state.status === "error" && (
        <ul className="space-y-1 rounded-card bg-[#FBE3DE] p-4 text-[14px] text-[#8F2F1C]" role="alert">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Sending…" : "Send suggestion"}
      </button>
      <p className="text-[13px] text-secondary">
        Nothing appears in the game until it&apos;s been checked. You can see your suggestions in your profile.
      </p>
    </form>
  );
}
