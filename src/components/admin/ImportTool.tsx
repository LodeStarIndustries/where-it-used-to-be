"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { commitImportAction, previewImportAction, type ImportPreview } from "@/lib/admin/actions";
import { Pill, adminButton, adminButtonSecondary, adminInput, adminLabel, adminTextarea } from "./ui";

export function ImportTool() {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [attach, setAttach] = useState<Record<number, string>>({});
  const [done, setDone] = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function reset() {
    setPreview(null);
    setAttach({});
    setDone(null);
    setError(null);
  }

  async function readFile(file: File) {
    reset();
    setFileName(file.name);
    setText(await file.text());
  }

  const valid = preview?.rows.filter((r) => r.errors.length === 0) ?? [];
  const withErrors = preview?.rows.filter((r) => r.errors.length > 0) ?? [];
  const needPin = valid.filter((r) => r.warnings.some((w) => w.startsWith("Needs a pin"))).length;
  const canImport = preview && preview.fileErrors.length === 0 && valid.length > 0;

  if (done) {
    return (
      <div className="space-y-3" role="status">
        <p className="text-[16px] font-semibold text-ink">
          Imported {done.created} {done.created === 1 ? "place" : "places"} as drafts.
          {done.skipped > 0 && ` Skipped ${done.skipped} with errors.`}
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
              setFileName(null);
            }}
          >
            Import another file
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label>
          <span className={adminLabel}>Choose a CSV file</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className={`${adminInput} py-1.5`}
            onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
          />
          <span className="mt-1 block text-[12px] text-secondary">
            From Google Sheets: File → Download → Comma-separated values (.csv).
          </span>
        </label>
        <label>
          <span className={adminLabel}>Or paste it</span>
          <textarea
            value={text}
            onChange={(e) => {
              reset();
              setFileName(null);
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
        className={adminButton}
        disabled={!text.trim() || pending}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              setPreview(await previewImportAction(text));
            } catch {
              setError("Couldn't check the file. Try again.");
            }
          })
        }
      >
        {pending && !preview ? "Checking…" : "Check the file (nothing is saved yet)"}
      </button>
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
          {preview.rows.length > 0 && (
            <div className="flex flex-wrap gap-2 text-[14px]">
              <Pill tone="live">{valid.length} ready to import</Pill>
              <Pill tone="warn">{withErrors.length} with errors (skipped)</Pill>
              <Pill tone="info">{needPin} will need a pin</Pill>
              {fileName && <span className="text-secondary">{fileName}</span>}
            </div>
          )}
          {preview.ignoredColumns.length > 0 && (
            <p className="text-[13px] text-secondary">Ignored columns: {preview.ignoredColumns.join(", ")}.</p>
          )}

          {preview.rows.length > 0 && (
            <div className="max-h-[60vh] overflow-auto rounded-card border border-divider bg-surface">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead className="sticky top-0 border-b border-divider bg-surface text-[12px] uppercase tracking-wide text-secondary">
                  <tr>
                    <th className="px-3 py-2">Line</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Checks</th>
                    <th className="px-3 py-2">Site</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider-soft">
                  {preview.rows.map((r) => (
                    <tr key={r.line} className={r.errors.length ? "bg-[#FDF3F1]" : ""}>
                      <td className="px-3 py-2 tabular-nums text-secondary">{r.line}</td>
                      <td className="px-3 py-2 font-semibold text-ink">{r.name || <em className="text-secondary">no name</em>}</td>
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
                          {r.errors.length === 0 && r.warnings.length === 0 && <li className="text-[#1F5E36]">✓ Ready</li>}
                        </ul>
                      </td>
                      <td className="px-3 py-2">
                        {r.errors.length === 0 && r.nearby.length > 0 ? (
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
                          <span className="text-secondary">New site</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canImport && (
            <button
              type="button"
              className={adminButton}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await commitImportAction(text, attach);
                  if (r.ok) setDone({ created: r.created, skipped: r.skipped });
                  else setError(r.errors.join(" "));
                })
              }
            >
              {pending ? "Importing…" : `Import ${valid.length} as drafts`}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
