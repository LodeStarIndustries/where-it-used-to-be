"use client";
// A map for placing one pin: click to drop it, drag to adjust. Used by the
// admin place editor (full labelled map) and by Suggest a place (the players'
// street-names-only map). Other sites can be shown as small dots for context.
import "maplibre-gl/dist/maplibre-gl.css";
import "@/components/game/game-map.css";
import { getVersion, Map as MapLibre, Marker, Popup, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { game } from "@config/game";
import { gameMapStyle, type MapStyle } from "@/lib/game/map-style";

setWorkerUrl(`/maplibre/worker-${getVersion()}.mjs`);

export interface LatLngValue {
  lat: number;
  lng: number;
}

export interface OtherSite {
  id: string;
  lat: number;
  lng: number;
  names: string[];
}

let gameStyle: Promise<MapStyle> | null = null;
function loadGameStyle() {
  gameStyle ??= fetch(game.map.styleUrl)
    .then((r) => r.json() as Promise<MapStyle>)
    .then(gameMapStyle)
    .catch((e) => {
      gameStyle = null;
      throw e;
    });
  return gameStyle;
}

function pinElement() {
  const el = document.createElement("div");
  el.className = "wiutb-marker";
  const pin = document.createElement("div");
  pin.className = "wiutb-pin wiutb-pin-site";
  el.appendChild(pin);
  return el;
}

export function PinMap(props: {
  value: LatLngValue | null;
  onChange: (v: LatLngValue) => void;
  /** "admin" shows every label; "player" uses the game's street-names-only map. */
  variant: "admin" | "player";
  otherSites?: OtherSite[];
  className?: string;
  label: string;
}) {
  const { value, onChange, variant, otherSites, className = "h-80", label } = props;
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    let cancelled = false;
    let map: MapLibre | null = null;
    const style = variant === "admin" ? Promise.resolve(game.map.adminStyleUrl) : loadGameStyle();
    style
      .then((s) => {
        if (cancelled || !box.current) return;
        map = new MapLibre({
          container: box.current,
          style: s as never,
          center: value ? [value.lng, value.lat] : [...game.map.center],
          zoom: value ? 16 : game.map.zoom,
          minZoom: game.map.minZoom,
          maxZoom: 19,
          maxBounds: [[...game.map.bounds[0]], [...game.map.bounds[1]]],
          dragRotate: false,
          pitchWithRotate: false,
          attributionControl: { compact: true },
        });
        map.touchZoomRotate.disableRotation();
        map.getCanvas().setAttribute("aria-label", `${label}. Click the map to place the pin, then drag it to adjust.`);
        map.on("click", (e) => onChangeRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
        map.on("load", () => {
          if (!map) return;
          map.addSource("others", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({
            id: "others",
            type: "circle",
            source: "others",
            paint: {
              "circle-radius": 5,
              "circle-color": "#12324A",
              "circle-opacity": 0.55,
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 1.5,
            },
          });
          map.on("click", "others", (e) => {
            const f = e.features?.[0];
            if (!f || !map) return;
            new Popup({ closeButton: false })
              .setLngLat(e.lngLat)
              .setText(String(f.properties?.names ?? ""))
              .addTo(map);
          });
          map.on("mouseenter", "others", () => map && (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", "others", () => map && (map.getCanvas().style.cursor = ""));
          mapRef.current = map;
          setReady(true);
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // The map is created once; value changes move the marker below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, label]);

  // The pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const marker = new Marker({ element: pinElement(), anchor: "bottom", draggable: true });
      marker.on("dragend", () => {
        const p = marker.getLngLat();
        onChangeRef.current({ lat: p.lat, lng: p.lng });
      });
      markerRef.current = marker.setLngLat([value.lng, value.lat]).addTo(map);
    } else {
      markerRef.current.setLngLat([value.lng, value.lat]);
    }
  }, [ready, value]);

  // Other sites as dots.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("others") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: (otherSites ?? []).map((s) => ({
        type: "Feature",
        properties: { names: s.names.join(" · ") || "Empty site" },
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      })),
    });
  }, [ready, otherSites]);

  return (
    <div className={`relative overflow-hidden rounded-card border border-divider ${className}`}>
      <div ref={box} className="h-full w-full" />
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-background p-4 text-center text-[14px] text-body">
          The map couldn&apos;t load. Check your connection and reload.
        </div>
      )}
    </div>
  );
}
