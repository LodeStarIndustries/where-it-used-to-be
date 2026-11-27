"use client";

import { useLayoutEffect, useRef } from "react";
import type { Era } from "@config/game";
import { alfaSlabOne, bungee, exo2, montserrat, righteous, shrikhand } from "./fonts";
import "./era-card.css";

type Style = "1970s" | "1980s" | "1990s" | "2000s" | "2010s" | "fallback";

const look: Record<Style, { panel: string; font: string; size: number; miniSize: number }> = {
  "1970s": { panel: "ec-e1970s", font: shrikhand.className, size: 34, miniSize: 22 },
  "1980s": { panel: "ec-e1980s", font: bungee.className, size: 28, miniSize: 20 },
  "1990s": { panel: "ec-e1990s", font: righteous.className, size: 32, miniSize: 22 },
  "2000s": { panel: "ec-e2000s", font: exo2.className, size: 32, miniSize: 22 },
  "2010s": { panel: "ec-e2010s", font: montserrat.className, size: 24, miniSize: 16 },
  fallback: { panel: "ec-fallback", font: alfaSlabOne.className, size: 30, miniSize: 20 },
};

/** Long names shrink to this size, then wrap. They never truncate. */
const MIN_SIZE = 20;
const MIN_MINI_SIZE = 14;

export interface EraCardProps {
  name: string;
  era: Era | null;
  yearClosed?: number | null;
  currentUse?: string | null;
  street?: string | null;
  /** Mini: name and era only, for the results recap. */
  mini?: boolean;
}

export function EraCard({ name, era, yearClosed, currentUse, street, mini = false }: EraCardProps) {
  const style: Style = era ?? "fallback";
  const { panel, font, size, miniSize } = look[style];
  const nameRef = useRef<HTMLHeadingElement>(null);
  const start = mini ? miniSize : size;
  const min = mini ? MIN_MINI_SIZE : MIN_SIZE;

  // Shrink the name until it fits on one line, down to the minimum; then let it wrap.
  useLayoutEffect(() => {
    const el = nameRef.current;
    if (!el) return;
    const fit = () => {
      el.classList.remove("ec-wrap");
      let s = start;
      el.style.fontSize = `${s}px`;
      while (el.scrollWidth > el.clientWidth + 1 && s > min) {
        s -= 1;
        el.style.fontSize = `${s}px`;
      }
      if (el.scrollWidth > el.clientWidth + 1) el.classList.add("ec-wrap");
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement ?? el);
    // Refit once the era font has downloaded (it changes the name's width).
    let cancelled = false;
    document.fonts?.ready.then(() => !cancelled && fit());
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [name, start, min, font]);

  const meta = mini ? (era ?? "Used to be") : yearClosed ? `Closed ${yearClosed}` : null;
  const nowText = [currentUse, street].filter(Boolean).join(" · ");

  return (
    <article className={`ec-card ${mini ? "ec-mini" : ""}`} aria-label={`${name}${era ? `, ${era}` : ""}`}>
      <div className={`ec-panel ${panel}`}>
        {style === "1990s" && (
          <>
            <svg className={"ec-squiggle"} viewBox="0 0 64 18" aria-hidden="true">
              <path
                d="M2 9 C 10 1, 14 1, 22 9 S 34 17, 42 9 S 54 1, 62 9"
                fill="none"
                stroke="#2FC6B6"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
            <span className={"ec-dot"} aria-hidden="true" />
          </>
        )}
        {style === "fallback" && !mini && <p className={"ec-used-to-be"}>USED TO BE</p>}
        <h3 ref={nameRef} className={`ec-name ${font}`} style={{ fontSize: start }}>
          {name}
        </h3>
        {meta && <p className={"ec-meta"}>{meta}</p>}
      </div>
      {!mini && nowText && (
        <div className={"ec-now"}>
          <span className={"ec-now-tag"}>NOW</span>
          <span className={"ec-now-text"}>{nowText}</span>
        </div>
      )}
    </article>
  );
}
