"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { getVersion, LngLatBounds, Map as MapLibre, Marker, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import { game } from "@config/game";
import { circleRing, type LatLng } from "@/lib/game/geo";
import { gameMapStyle, type MapStyle } from "@/lib/game/map-style";

// See scripts/copy-maplibre-worker.mjs.
setWorkerUrl(`/maplibre/worker-${getVersion()}.mjs`);

let styleCache: Promise<MapStyle> | null = null;
function loadStyle(): Promise<MapStyle> {
  styleCache ??= fetch(game.map.styleUrl)
    .then((r) => {
      if (!r.ok) throw new Error(`Map style ${r.status}`);
      return r.json() as Promise<MapStyle>;
    })
    .then(gameMapStyle)
    .catch((e) => {
      styleCache = null;
      throw e;
    });
  return styleCache;
}

export type MapMode = "pin" | "name" | "reveal";

export interface GameMapProps {
  mode: MapMode;
  /** Pin rounds: the player's pin, if dropped. */
  pin: LatLng | null;
  onPin?: (pin: LatLng) => void;
  /** Name rounds: the site being asked about. Reveal: the real site. */
  site?: LatLng | null;
  /** Reveal of a pin round: where the player guessed. */
  guess?: LatLng | null;
  /** Space the bottom card or sheet covers, so the reveal fits above it. */
  bottomInset?: number;
  /** Changes when the camera should move: a new round or phase. */
  viewKey: string;
}

function markerElement(kind: "player" | "site") {
  // MapLibre positions the outer element with a transform; the rotated teardrop is inside it.
  const el = document.createElement("div");
  el.className = "wiutb-marker";
  el.setAttribute("aria-hidden", "true");
  const pin = document.createElement("div");
  pin.className = kind === "player" ? "wiutb-pin wiutb-pin-player" : "wiutb-pin wiutb-pin-site";
  el.appendChild(pin);
  return el;
}

const toLngLat = (p: LatLng): [number, number] => [p.lng, p.lat];

export function GameMap({ mode, pin, onPin, site, guess, bottomInset = 0, viewKey }: GameMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const playerRef = useRef<Marker | null>(null);
  const siteRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [keyboardHint, setKeyboardHint] = useState(false);

  // Latest props for the map's own event handlers.
  const live = useRef({ mode, onPin });
  const view = useRef({ mode, site, guess });
  useEffect(() => {
    live.current = { mode, onPin };
    view.current = { mode, site, guess };
  });

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let map: MapLibre | null = null;
    loadStyle()
      .then((style) => {
        if (cancelled || !containerRef.current) return;
        map = new MapLibre({
          container: containerRef.current,
          style: style as never,
          center: [...game.map.center],
          zoom: game.map.zoom,
          minZoom: game.map.minZoom,
          maxZoom: game.map.maxZoom,
          maxBounds: [[...game.map.bounds[0]], [...game.map.bounds[1]]],
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          maxPitch: 0,
          attributionControl: { compact: true },
        });
        map.touchZoomRotate.disableRotation();
        map.keyboard.disableRotation();
        map.getCanvas().setAttribute(
          "aria-label",
          "Map of Saint John. Arrow keys move the map; in a pin round, Enter drops your pin at the centre.",
        );

        map.on("click", (e) => {
          if (live.current.mode === "pin") live.current.onPin?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        });
        const container = map.getCanvasContainer();
        container.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && live.current.mode === "pin" && map) {
            // The point under the crosshair (the middle of the map element). getCenter()
            // would allow for the camera padding and land above it.
            const canvas = map.getCanvas();
            const c = map.unproject([canvas.clientWidth / 2, canvas.clientHeight / 2]);
            live.current.onPin?.({ lat: c.lat, lng: c.lng });
            e.preventDefault();
          }
        });
        // The crosshair is for keyboard users only.
        map.getCanvas().addEventListener("focus", (e) =>
          setKeyboardHint((e.target as HTMLElement).matches(":focus-visible")),
        );
        map.getCanvas().addEventListener("blur", () => setKeyboardHint(false));
        map.getCanvas().addEventListener("pointerdown", () => setKeyboardHint(false));

        map.on("load", () => {
          if (!map) return;
          map.addSource("reveal", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({
            id: "reveal-circle-fill",
            type: "fill",
            source: "reveal",
            filter: ["==", ["get", "kind"], "circle"],
            paint: { "fill-color": "#B5452F", "fill-opacity": 0.12 },
          });
          map.addLayer({
            id: "reveal-circle-line",
            type: "line",
            source: "reveal",
            filter: ["==", ["get", "kind"], "circle"],
            paint: { "line-color": "#B5452F", "line-width": 1.5 },
          });
          map.addLayer({
            id: "reveal-line",
            type: "line",
            source: "reveal",
            filter: ["==", ["get", "kind"], "line"],
            paint: { "line-color": "#12324A", "line-width": 2, "line-dasharray": [2, 2] },
          });
          mapRef.current = map;
          setReady(true);
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // Player pin: draggable while placing, fixed on reveal.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const show = mode === "reveal" ? guess : mode === "pin" ? pin : null;
    if (!show) {
      playerRef.current?.remove();
      playerRef.current = null;
      return;
    }
    if (!playerRef.current) {
      const marker = new Marker({ element: markerElement("player"), anchor: "bottom", draggable: true });
      marker.on("dragend", () => {
        const p = marker.getLngLat();
        if (live.current.mode === "pin") live.current.onPin?.({ lat: p.lat, lng: p.lng });
      });
      playerRef.current = marker.setLngLat(toLngLat(show)).addTo(map);
    } else {
      playerRef.current.setLngLat(toLngLat(show));
    }
    playerRef.current.setDraggable(mode === "pin");
  }, [ready, mode, pin, guess]);

  // Site marker (name rounds and every reveal), the reveal circle and line, and the camera.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource("reveal") as GeoJSONSource | undefined;
    siteRef.current?.remove();
    siteRef.current = null;

    if (site && (mode === "name" || mode === "reveal")) {
      siteRef.current = new Marker({ element: markerElement("site"), anchor: "bottom" }).setLngLat(toLngLat(site)).addTo(map);
    }

    const features: GeoJSON.Feature[] = [];
    if (mode === "reveal" && site) {
      features.push({
        type: "Feature",
        properties: { kind: "circle" },
        geometry: { type: "Polygon", coordinates: [circleRing(site, game.map.revealCircleMeters)] },
      });
      if (guess) {
        features.push({
          type: "Feature",
          properties: { kind: "line" },
          geometry: { type: "LineString", coordinates: [toLngLat(guess), toLngLat(site)] },
        });
      }
    }
    source?.setData({ type: "FeatureCollection", features });
  }, [ready, mode, site, guess]);

  // Move the camera when the round or phase changes. For a moment afterwards, also
  // follow the bottom card or sheet as it settles (fonts load, content grows), but
  // never after that, so the camera doesn't fight the player.
  const lastMove = useRef(0);
  const inset = useRef(bottomInset);
  const moveCamera = useCallback((animate: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    const { mode, site, guess } = view.current;
    const padding = { top: 90, left: 40, right: 40, bottom: inset.current + 40 };
    const duration = animate ? 700 : 300;
    if (mode === "reveal" && site) {
      const bounds = new LngLatBounds(toLngLat(site), toLngLat(site));
      if (guess) bounds.extend(toLngLat(guess));
      map.fitBounds(bounds, { padding, maxZoom: 16, duration });
    } else if (mode === "name" && site) {
      map.easeTo({ center: toLngLat(site), zoom: 15.5, padding, duration });
    } else if (mode === "pin" && animate) {
      map.easeTo({ center: [...game.map.center], zoom: game.map.zoom, padding, duration });
    }
  }, []);

  useEffect(() => {
    const changed = Math.abs(inset.current - bottomInset) > 8;
    inset.current = bottomInset;
    if (changed && ready && Date.now() - lastMove.current < 1500) moveCamera(false);
  }, [bottomInset, ready, moveCamera]);

  useEffect(() => {
    if (!ready) return;
    lastMove.current = Date.now();
    moveCamera(true);
  }, [ready, viewKey, moveCamera]);

  return (
    <div className="absolute inset-0" style={{ "--map-bottom": `${bottomInset}px` } as React.CSSProperties}>
      {/* MapLibre makes its container position: relative, so it fills its parent by size. */}
      <div ref={containerRef} className="h-full w-full" />
      {mode === "pin" && keyboardHint && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
          <svg width="36" height="36" viewBox="0 0 36 36">
            <path d="M18 2v12M18 22v12M2 18h12M22 18h12" stroke="#12324A" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-background p-6 text-center text-[15px] text-body">
          The map couldn&apos;t load. Check your connection and reload the page.
        </div>
      )}
    </div>
  );
}
