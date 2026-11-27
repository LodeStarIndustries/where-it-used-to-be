"use client";
// The admin place editor: map pin, site fields, place fields, sources, a live
// era card preview, and the verify / go-live controls.
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { categories, eras, type Category, type Era } from "@config/game";
import {
  attachToSiteAction,
  deleteDraftAction,
  nearbySitesAction,
  savePlaceAction,
  setStatusAction,
  setVerifiedAction,
  type ActionResult,
} from "@/lib/admin/actions";
import type { NearbySite, PlaceDetail } from "@/lib/admin/data";
import { liveBlockers, type SourceInput } from "@/lib/admin/place-schema";
import { streetFromAddress } from "@/lib/game/geo";
import { EraCard } from "@/components/era-card/EraCard";
import { categoryLabel } from "@/components/game/labels";
import { PinMap, type LatLngValue, type OtherSite } from "@/components/map/PinMap";
import {
  Pill,
  adminButton,
  adminButtonDanger,
  adminButtonSecondary,
  adminInput,
  adminLabel,
  adminTextarea,
} from "./ui";

interface Fields {
  name: string;
  category: Category;
  addressText: string;
  currentUse: string;
  neighbourhood: string;
  yearOpened: string;
  yearClosed: string;
  era: Era | "";
  fact: string;
  difficulty: "" | "1" | "2" | "3";
  notes: string;
  sources: SourceInput[];
}

const s = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

function initialFields(p: PlaceDetail | null): Fields {
  return {
    name: s(p?.name),
    category: p?.category ?? "restaurant",
    addressText: s(p?.addressText),
    currentUse: s(p?.currentUse),
    neighbourhood: s(p?.neighbourhood),
    yearOpened: s(p?.yearOpened),
    yearClosed: s(p?.yearClosed),
    era: p?.era ?? "",
    fact: s(p?.fact),
    difficulty: (p?.difficulty ? String(p.difficulty) : "") as Fields["difficulty"],
    notes: s(p?.notes),
    sources: p?.sources ?? [],
  };
}

function Messages({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  if (result.ok) {
    return result.message ? (
      <p className="text-[14px] text-[#1F5E36]" role="status">
        {result.message}
      </p>
    ) : null;
  }
  return (
    <ul className="space-y-1 rounded-button bg-[#FBE3DE] p-3 text-[14px] text-[#8F2F1C]" role="alert">
      {result.errors.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
}

export function PlaceEditor({ place, otherSites }: { place: PlaceDetail | null; otherSites: OtherSite[] }) {
  const router = useRouter();
  const [fields, setFields] = useState<Fields>(() => initialFields(place));
  const [pin, setPin] = useState<LatLngValue | null>(
    place?.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : null,
  );
  const [nearby, setNearby] = useState<NearbySite[]>([]);
  const [attachSiteId, setAttachSiteId] = useState<string | null>(null);
  const [saveResult, saveAction, saving] = useActionState(savePlaceAction, null);
  const [statusResult, setStatusResult] = useState<ActionResult | null>(null);
  const [busy, startTransition] = useTransition();

  const saved = useMemo(() => JSON.stringify(initialFields(place)), [place]);
  const savedPin = place?.lat != null ? `${place.lat},${place.lng}` : "";
  const dirty = JSON.stringify(fields) !== saved || (pin ? `${pin.lat},${pin.lng}` : "") !== savedPin;

  // When the server sends fresh data after a save, start from it.
  const lastPlace = useRef(place);
  useEffect(() => {
    if (lastPlace.current !== place) {
      lastPlace.current = place;
      Promise.resolve().then(() => {
        setFields(initialFields(place));
        setPin(place?.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : null);
      });
    }
  }, [place]);

  useEffect(() => {
    if (saveResult?.ok) router.refresh();
  }, [saveResult, router]);

  // Look for existing sites within 30 m whenever the pin moves.
  useEffect(() => {
    if (!pin) return;
    const t = setTimeout(() => {
      nearbySitesAction(pin.lat, pin.lng, place?.siteId ?? null)
        .then(setNearby)
        .catch(() => setNearby([]));
    }, 350);
    return () => clearTimeout(t);
  }, [pin, place?.siteId]);

  const set = <K extends keyof Fields>(k: K) => (v: Fields[K]) => setFields((f) => ({ ...f, [k]: v }));
  const payload = JSON.stringify({ ...fields, lat: pin?.lat ?? null, lng: pin?.lng ?? null });

  function run(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      const r = await action();
      setStatusResult(r);
      if (r.ok) router.refresh();
    });
  }

  const blockers = place ? liveBlockers({ lat: place.lat, difficulty: place.difficulty, verifiedAt: place.verifiedAt }) : [];
  const others = useMemo(() => otherSites.filter((o) => o.id !== place?.siteId), [otherSites, place?.siteId]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <form action={saveAction} className="min-w-0 space-y-6">
        <input type="hidden" name="payload" value={payload} />
        {place && <input type="hidden" name="id" value={place.id} />}
        {place && <input type="hidden" name="siteId" value={place.siteId} />}
        {!place && attachSiteId && <input type="hidden" name="attachSiteId" value={attachSiteId} />}

        <section className="rounded-card bg-surface p-4 shadow-card">
          <h2 className="mb-3 text-[17px] font-bold text-ink">Where it was</h2>
          <PinMap
            variant="admin"
            value={pin}
            onChange={(v) => {
              setPin(v);
              setAttachSiteId(null);
            }}
            otherSites={others}
            className="h-[420px]"
            label="Map for placing this site"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px] text-secondary">
            {pin ? (
              <>
                <span className="tabular-nums">
                  {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
                </span>
                <button type="button" className="font-semibold text-accent underline" onClick={() => setPin(null)}>
                  Remove pin
                </button>
              </>
            ) : (
              <span className="font-semibold text-accent">No pin yet: click the map where it was.</span>
            )}
            <span>Dark dots are other sites; click one to see what&apos;s there.</span>
          </div>
          {nearby.length > 0 && pin && (
            <div className="mt-3 rounded-button bg-[#E1ECF4] p-3 text-[14px] text-ink">
              <p className="font-semibold">This pin is within 30 m of an existing site:</p>
              <ul className="mt-2 space-y-2">
                {nearby.map((n) => (
                  <li key={n.siteId} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {n.placeNames.join(", ") || "An empty site"}
                      {n.addressText ? ` · ${n.addressText}` : ""} <span className="text-secondary">({n.distanceM} m)</span>
                    </span>
                    {place ? (
                      <button
                        type="button"
                        className={adminButtonSecondary}
                        disabled={busy}
                        onClick={() => run(() => attachToSiteAction(place.id, place.siteId, n.siteId))}
                      >
                        Use that site
                      </button>
                    ) : attachSiteId === n.siteId ? (
                      <Pill tone="info">Will be added there</Pill>
                    ) : (
                      <button type="button" className={adminButtonSecondary} onClick={() => setAttachSiteId(n.siteId)}>
                        Use that site
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[13px] text-body">
                Places on the same site never appear in the same day, and never as each other&apos;s wrong answers.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-card bg-surface p-4 shadow-card">
          <h2 className="text-[17px] font-bold text-ink">The site</h2>
          {place && place.siteSiblings.length > 0 && (
            <p className="mt-1 text-[13px] text-secondary">
              Shared with {place.siteSiblings.map((x) => x.name).join(", ")}. Changes here (and the pin) apply to them too.
            </p>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className={adminLabel}>Address or nearest intersection</span>
              <input value={fields.addressText} onChange={(e) => set("addressText")(e.target.value)} maxLength={200} className={adminInput} />
            </label>
            <label>
              <span className={adminLabel}>What&apos;s there now</span>
              <input value={fields.currentUse} onChange={(e) => set("currentUse")(e.target.value)} maxLength={120} className={adminInput} />
            </label>
            <label>
              <span className={adminLabel}>Neighbourhood</span>
              <input value={fields.neighbourhood} onChange={(e) => set("neighbourhood")(e.target.value)} maxLength={80} className={adminInput} />
            </label>
            <label className="sm:col-span-2">
              <span className={adminLabel}>Admin notes (never shown to players)</span>
              <textarea value={fields.notes} onChange={(e) => set("notes")(e.target.value)} maxLength={2000} rows={3} className={adminTextarea} />
            </label>
          </div>
        </section>

        <section className="rounded-card bg-surface p-4 shadow-card">
          <h2 className="text-[17px] font-bold text-ink">The business</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className={adminLabel}>Name, as people remember it</span>
              <input value={fields.name} onChange={(e) => set("name")(e.target.value)} maxLength={120} required className={adminInput} />
            </label>
            <label>
              <span className={adminLabel}>Category</span>
              <select value={fields.category} onChange={(e) => set("category")(e.target.value as Category)} className={adminInput}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel[c]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={adminLabel}>Era (card style)</span>
              <select value={fields.era} onChange={(e) => set("era")(e.target.value as Era | "")} className={adminInput}>
                <option value="">None (fallback card)</option>
                {eras.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={adminLabel}>Year opened</span>
              <input value={fields.yearOpened} onChange={(e) => set("yearOpened")(e.target.value)} inputMode="numeric" maxLength={4} className={adminInput} />
            </label>
            <label>
              <span className={adminLabel}>Year closed</span>
              <input value={fields.yearClosed} onChange={(e) => set("yearClosed")(e.target.value)} inputMode="numeric" maxLength={4} className={adminInput} />
            </label>
            <label>
              <span className={adminLabel}>Difficulty</span>
              <select value={fields.difficulty} onChange={(e) => set("difficulty")(e.target.value as Fields["difficulty"])} className={adminInput}>
                <option value="">Not set</option>
                <option value="1">1: most people know it</option>
                <option value="2">2: locals know it</option>
                <option value="3">3: deep cut</option>
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className={adminLabel}>
                Fact (one line) <span className="font-normal text-secondary">· {fields.fact.length}/160</span>
              </span>
              <textarea value={fields.fact} onChange={(e) => set("fact")(e.target.value)} maxLength={160} rows={2} className={adminTextarea} />
            </label>
          </div>
        </section>

        <section className="rounded-card bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-bold text-ink">Sources</h2>
            <button
              type="button"
              className={adminButtonSecondary}
              onClick={() => set("sources")([...fields.sources, { label: "", url: "" }])}
              disabled={fields.sources.length >= 10}
            >
              Add a source
            </button>
          </div>
          {fields.sources.length === 0 && <p className="mt-2 text-[14px] text-body">No sources yet.</p>}
          <ul className="mt-3 space-y-3">
            {fields.sources.map((src, i) => (
              <li key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
                <label>
                  <span className={adminLabel}>Label</span>
                  <input
                    value={src.label}
                    onChange={(e) => set("sources")(fields.sources.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    className={adminInput}
                    placeholder="CBC: Old Woolworth's comes down"
                  />
                </label>
                <label>
                  <span className={adminLabel}>Link</span>
                  <input
                    value={src.url}
                    onChange={(e) => set("sources")(fields.sources.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                    className={adminInput}
                    inputMode="url"
                    placeholder="https://"
                  />
                </label>
                <button
                  type="button"
                  className={adminButtonDanger}
                  onClick={() => set("sources")(fields.sources.filter((_, j) => j !== i))}
                >
                  Remove<span className="sr-only"> source {i + 1}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-divider bg-background/95 px-4 py-3 backdrop-blur">
          <button type="submit" className={adminButton} disabled={saving || (!dirty && Boolean(place))}>
            {saving ? "Saving…" : place ? "Save changes" : "Create draft"}
          </button>
          {dirty && place && <span className="text-[13px] text-secondary">Unsaved changes</span>}
          <div className="w-full">
            <Messages result={saveResult} />
          </div>
        </div>
      </form>

      <aside className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
        <section className="rounded-card bg-surface p-4 shadow-card">
          <h2 className="mb-3 text-[17px] font-bold text-ink">Era card preview</h2>
          <EraCard
            name={fields.name || "Business name"}
            era={fields.era || null}
            yearClosed={Number(fields.yearClosed) || null}
            currentUse={fields.currentUse || null}
            street={streetFromAddress(fields.addressText)}
          />
          {fields.fact && <p className="mt-3 text-[14px] leading-relaxed text-body">{fields.fact}</p>}
        </section>

        {place && (
          <section className="space-y-3 rounded-card bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={place.status}>{place.status}</Pill>
              {place.verifiedAt ? (
                <Pill tone="live">verified {place.verifiedAt.slice(0, 10)}</Pill>
              ) : (
                <Pill tone="info">unverified</Pill>
              )}
              <span className="text-[13px] text-secondary">Last used: {place.lastUsedOn ?? "never"}</span>
            </div>
            {dirty && <p className="text-[13px] text-accent">Save your changes before changing the status.</p>}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={adminButtonSecondary}
                disabled={busy || dirty}
                onClick={() => run(() => setVerifiedAction(place.id, !place.verifiedAt))}
              >
                {place.verifiedAt ? "Unverify" : "Mark verified"}
              </button>
              {place.status !== "live" && (
                <button
                  type="button"
                  className={adminButton}
                  disabled={busy || dirty || blockers.length > 0}
                  onClick={() => run(() => setStatusAction(place.id, "live"))}
                >
                  Make live
                </button>
              )}
              {place.status === "live" && (
                <button type="button" className={adminButtonSecondary} disabled={busy} onClick={() => run(() => setStatusAction(place.id, "draft"))}>
                  Back to draft
                </button>
              )}
              {place.status !== "retired" && (
                <button type="button" className={adminButtonSecondary} disabled={busy} onClick={() => run(() => setStatusAction(place.id, "retired"))}>
                  Retire
                </button>
              )}
              {place.status === "retired" && (
                <button type="button" className={adminButtonSecondary} disabled={busy} onClick={() => run(() => setStatusAction(place.id, "draft"))}>
                  Back to draft
                </button>
              )}
            </div>
            {place.status !== "live" && blockers.length > 0 && (
              <p className="text-[13px] text-body">To go live, it {blockers.join(", ")}.</p>
            )}
            <Messages result={statusResult} />
            {place.status === "draft" && !place.lastUsedOn && (
              <button
                type="button"
                className="text-[13px] font-semibold text-accent underline"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Delete the draft "${place.name}"? This can't be undone.`)) {
                    run(() => deleteDraftAction(place.id, place.siteId));
                  }
                }}
              >
                Delete this draft
              </button>
            )}
          </section>
        )}
      </aside>
    </div>
  );
}
