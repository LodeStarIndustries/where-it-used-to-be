// Small geometry helpers. Pure functions, safe on the server and in the browser.

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle (haversine) distance in metres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A closed ring of [lng, lat] points approximating a circle, for drawing on the map. */
export function circleRing(center: LatLng, radiusMeters: number, steps = 64): [number, number][] {
  const ring: [number, number][] = [];
  const latRad = toRad(center.lat);
  const dLat = (radiusMeters / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLng = dLat / Math.cos(latRad);
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    ring.push([center.lng + dLng * Math.cos(t), center.lat + dLat * Math.sin(t)]);
  }
  return ring;
}

/**
 * The street part of an address, for the era card's Now bar:
 * "5 Golden Grove Rd" -> "Golden Grove Rd", "96-100 Germain St" -> "Germain St".
 * Intersections and other text pass through unchanged.
 */
export function streetFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const trimmed = address.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^\d+[A-Za-z]?(?:\s*[-–]\s*\d+[A-Za-z]?)?,?\s+/, "") || trimmed;
}
