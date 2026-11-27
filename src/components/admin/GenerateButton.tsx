"use client";

import { useState, useTransition } from "react";
import { generateMissingAction, type ActionResult } from "@/lib/admin/actions";
import { adminButton } from "./ui";

export function GenerateButton({ missing }: { missing: number }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className={adminButton}
        disabled={pending || missing === 0}
        onClick={() => start(async () => setResult(await generateMissingAction()))}
      >
        {pending ? "Generating…" : missing ? `Generate ${missing} missing ${missing === 1 ? "day" : "days"}` : "All days generated"}
      </button>
      {result && (
        <p className={`text-[14px] ${result.ok ? "text-[#1F5E36]" : "text-[#8F2F1C]"}`} role={result.ok ? "status" : "alert"}>
          {result.ok ? result.message : result.errors.join(" ")}
        </p>
      )}
    </div>
  );
}
