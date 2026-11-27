"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import {
  commitImportAction,
  fetchSheetAction,
  previewImportAction,
  type ImportPreview,
  type ImportPreviewRow,
} from "@/lib/admin/actions";
import { Pill, adminButton, adminButtonSecondary, adminInput, adminLabel, adminTextarea } from "./ui";

// The sheet link is remembered in this browser only. The repo is public, so it never goes in the code.
const SHEET_KEY = "wiutb.admin.sheetUrl";

function savedSheetUrl(): string {
  try {
    return localStorage.getItem(SHEET_KEY) ?? "";
  } catch {
    return ""; // Storage blocked: the field just starts empty.
  }
}
const noSubscribe = () => () => {};

type Done = { created: number; updated: number; unchanged: number; skipped: number };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function WhatHappens({ row }: { row: ImportPreviewRow }) {
  switch (row.kind) {
    case "new":
      return <Pill tone="live">New draft</Pill>;
    case "update":
      return (
        <span>
          <Pill tone="info">Update</Pill>
          <span className="mt-1 block text-[12px] text-body">{row.changes.join(", ")}</span>
        </span>
      );
    case "same":
      return <span className="text-secondary">No change</span>;
    default:
      return <Pill tone="warn">Skipped</Pill>;
  }
}

export function ImportTool() {
  const saved = useSyncExternalStore(noSubscribe, savedSheetUrl, () => "");
  const [typed, setSheetUrl] = useState<string | null>(null);
  const sheetUrl = typed ?? saved;
  const [text, setText] = useState("");
  const [source, setSource] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [attach, setAttach] = useState<Record<number, string>>({});
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function reset() {
    setPreview(null);
    setAttach({});
    setDone(null);
    setError(null);
  }

  async function check(csv: string) {
    try {
      setPreview(await previewImportAction(csv));
    } catch {
      setError("Couldn't check it. Try again.");
    }
  }

  function checkSheet() {
    start(async () => {
      reset();
      const r = await fetchSheetAction(sheetUrl);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      try {
        localStorage.setItem(SHEET_KEY, sheetUrl.trim());
      } catch {
        // Not remembered; nothing else changes.
      }
      setText(r.text);
      setSource("Google Sheet");
      await check(r.text);
    });
  }

  async function readFile(file: File) {
    reset();
    setSource(file.name);
    setText(await file.text());
  }

  const rows = preview?.rows ?? [];
  const added = rows.filter((r) => r.kind === "new");
  const updates = rows.filter((r) => r.kind === "update");
  const unchanged = rows.filter((r) => r.kind === "same").length;
  const withErrors = rows.filter((r) => r.kind === "error").length;
  const needPin = rows.filter((r) => r.kind !== "error" && r.warnings.some((w) => w.startsWith("Needs a pin"))).length;
  const canImport = preview && preview.fileErrors.length === 0 && added.length + updates.length > 0;
  const importLabel = [
    added.length ? `add ${plural(added.length, "draft")}` : null,
    updates.length ? `update ${plural(updates.length, "place")}` : null,
  ]
    .filter(Boolean)
    .join(" and ");

  if (done) {
    return (
      <div className="space-y-3" role="status">
        <p className="text-[16px] font-semibold text-ink">
          Added {plural(done.created, "draft")} and updated {plural(done.updated, "place")}.
          {done.unchanged > 0 && ` ${plural(done.unchanged, "place")} had no changes.`}
          {done.skipped > 0 && ` Skipped ${plural(done.skipped, "row")} with errors.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/places?status=draft&needsPin=1" className={adminButton}>
            Pin the drafts that need it
          </Link>
          <button
            type="button"
            className={adminButtonSecondary}
            onClick={() => {
              reset();
              setText("");
              setSource(null);
            }}
          >
            Import again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          checkSheet();
        }}
      >
        <label className="block">
          <span className={adminLabel}>Google Sheet link</span>
          <input
            type="url"
            inputMode="url"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=0"
            className={adminInput}
          />
          <span className="mt-1 block text-[12px] text-secondary">
            Open the tab with your places and copy the address bar. The sheet must be shared as &ldquo;Anyone with the
            link&rdquo; (Viewer). This browser remembers the link.
          </span>
        </label>
        <button type="submit" className={adminButton} disabled={!sheetUrl.trim() || pending}>
          {pending && !preview ? "Reading the sheet…" : "Check the sheet (nothing is saved yet)"}
        </button>
      </form>

      <details className="rounded-card border border-divider bg-surface p-3">
        <summary className="cursor-pointer text-[14px] font-semibold text-ink">Or use a CSV file</summary>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <label>
            <span className={adminLabel}>Choose a CSV file</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className={`${adminInput} py-1.5`}
              onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
            />
          </label>
          <label>
            <span className={adminLabel}>Or paste it</span>
            <textarea
              value={text}
              onChange={(e) => {
                reset();
                setSource(null);
                setText(e.target.value);
              }}
              rows={4}
              className={`${adminTextarea} font-mono text-[12px]`}
              placeholder="name,category,address_text,…"
            />
          </label>
        </div>
        <button
          type="button"
          className={`${adminButtonSecondary} mt-3`}
          disabled={!text.trim() || pending}
          onClick={() =>
            start(async () => {
              setError(null);
              await check(text);
            })
          }
        >
          Check the file (nothing is saved yet)
        </button>
      </details>

      {error && (
        <p className="text-[14px] text-accent" role="alert">
          {error}
        </p>
      )}

      {preview && (
        <section className="space-y-3" aria-label="Import preview">
          {preview.fileErrors.length > 0 && (
            <ul className="rounded-button bg-[#FBE3DE] p-3 text-[14px] text-[#8F2F1C]" role="alert">
              {preview.fileErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[14px]">
              <Pill tone="live">{added.length} new</Pill>
              <Pill tone="info">{updates.length} to update</Pill>
              <Pill tone="retired">{unchanged} unchanged</Pill>
              <Pill tone="warn">{withErrors} with errors (skipped)</Pill>
              {needPin > 0 && <span className="text-body">{plural(needPin, "place")} will need a pin</span>}
              {source && <span className="text-secondary">· {source}</span>}
            </div>
          )}
          {preview.ignoredColumns.length > 0 && (
            <p className="text-[13px] text-secondary">Ignored columns: {preview.ignoredColumns.join(", ")}.</p>
          )}

          {rows.length > 0 && (
            <div className="max-h-[60vh] overflow-auto rounded-card border border-divider bg-surface">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead className="sticky top-0 border-b border-divider bg-surface text-[12px] uppercase tracking-wide text-secondary">
                  <tr>
                    <th className="px-3 py-2">Line</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">What happens</th>
                    <th className="px-3 py-2">Checks</th>
                    <th className="px-3 py-2">Site</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider-soft">
                  {rows.map((r) => (
                    <tr key={r.line} className={r.kind === "error" ? "bg-[#FDF3F1]" : r.kind === "same" ? "text-secondary" : ""}>
                      <td className="px-3 py-2 tabular-nums text-secondary">{r.line}</td>
                      <td className="px-3 py-2 font-semibold text-ink">{r.name || <em className="text-secondary">no name</em>}</td>
                      <td className="px-3 py-2">
                        <WhatHappens row={r} />
                      </td>
                      <td className="px-3 py-2">
                        <ul className="space-y-0.5">
                          {r.errors.map((e) => (
                            <li key={e} className="text-[#8F2F1C]">
                              ✕ {e}
                            </li>
                          ))}
                          {r.warnings.map((w) => (
                            <li key={w} className="text-body">
                              • {w}
                            </li>
                          ))}
                          {r.errors.length === 0 && r.warnings.length === 0 && r.kind !== "same" && (
                            <li className="text-[#1F5E36]">✓ Ready</li>
                          )}
                        </ul>
                      </td>
                      <td className="px-3 py-2">
                        {r.kind === "new" && r.nearby.length > 0 ? (
                          <label>
                            <span className="sr-only">Site for line {r.line}</span>
                            <select
                              className={`${adminInput} h-9 text-[13px]`}
                              value={attach[r.line] ?? ""}
                              onChange={(e) => setAttach((a) => ({ ...a, [r.line]: e.target.value }))}
                            >
                              <option value="">New site</option>
                              {r.nearby.map((n) => (
                                <option key={n.siteId} value={n.siteId}>
                                  Share with {n.placeNames.join(", ") || "empty site"} ({n.distanceM} m)
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <span className="text-secondary">{r.kind === "new" ? "New site" : r.kind === "error" ? "" : "Its own"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview && preview.fileErrors.length === 0 && rows.length > 0 && !canImport && (
            <p className="text-[14px] text-body">Nothing to import: every row is unchanged or has errors.</p>
          )}
          {canImport && (
            <button
              type="button"
              className={adminButton}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await commitImportAction(text, attach);
                  if (r.ok) setDone(r);
                  else setError(r.errors.join(" "));
                })
              }
            >
              {pending ? "Importing…" : importLabel.charAt(0).toUpperCase() + importLabel.slice(1)}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
