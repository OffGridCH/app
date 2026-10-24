import { formatListTime } from '../format/time';

/** Ein Punkt auf der Erde. */
export type LatLon = { latitude: number; longitude: number };

/** Erdradius in Metern. */
const EARTH_RADIUS_M = 6_371_000;

/** Die acht Himmelsrichtungen, jede 45° breit, Mitte bei 0°, 45°, 90° … */
const COMPASS_NAMES = [
  'Norden',
  'Nordosten',
  'Osten',
  'Südosten',
  'Süden',
  'Südwesten',
  'Westen',
  'Nordwesten',
] as const;

/** Kilometer mit einer Nachkommastelle, Schweizer Format („1.2 km“). */
const oneDecimalFormat = new Intl.NumberFormat('de-CH', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Ganze Kilometer („12 km“). */
const wholeFormat = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 });

/** Grad in Radiant. */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Entfernung zwischen zwei Punkten (Haversine, Erdradius 6 371 000 m). */
export function distanceMeters(a: LatLon, b: LatLon): number {
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Anfangskurs von `from` nach `to` in Grad: 0 = Norden, im Uhrzeigersinn, 0 bis 359.9. */
export function bearingDegrees(from: LatLon, to: LatLon): number {
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Himmelsrichtung zu einem Kurs in Grad (8 Sektoren à 45°, Mitte bei 0°, 45°, 90° …). */
export function compassName(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % COMPASS_NAMES.length;
  return COMPASS_NAMES[index];
}

/**
 * Entfernung als Text: unter einem Kilometer in Metern („850 m“), sonst in Kilometern
 * („1.2 km“, ab 10 km ganze Kilometer „12 km“).
 */
export function formatDistance(m: number): string {
  const rounded = Math.round(m / 10) * 10;
  if (rounded < 1000) {
    return `${rounded} m`;
  }
  const km = Math.round(rounded / 100) / 10;
  if (km < 10) {
    return `${oneDecimalFormat.format(km)} km`;
  }
  return `${wholeFormat.format(km)} km`;
}

/** Koordinate als Text mit Hemisphäre („47.05021° N, 8.30934° O“). */
export function formatCoordinate(lat: number, lon: number): string {
  const latitude = `${Math.abs(lat).toFixed(5)}° ${lat < 0 ? 'S' : 'N'}`;
  const longitude = `${Math.abs(lon).toFixed(5)}° ${lon < 0 ? 'W' : 'O'}`;
  return `${latitude}, ${longitude}`;
}

/** Koordinate zum Kopieren, ohne Hemisphäre („47.05021, 8.30934“). */
export function formatCoordinatePlain(lat: number, lon: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

/** Genauigkeit als Text („±8 m“). */
export function formatAccuracy(m: number): string {
  return `±${Math.max(1, Math.round(m))} m`;
}

/** Wie alt ein Fix ist („gerade eben“, „vor 12 Min.“, „vor 3 Std.“, sonst das Listenformat). */
export function formatAgo(iso: string, now: Date): string {
  const elapsed = now.getTime() - Date.parse(iso);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) {
    return 'gerade eben';
  }
  if (minutes < 60) {
    return `vor ${minutes} Min.`;
  }
  if (elapsed < 24 * 3_600_000) {
    return `vor ${Math.floor(elapsed / 3_600_000)} Std.`;
  }
  return formatListTime(iso, now);
}

/** Koordinate auf sechs Nachkommastellen runden (für den Funk). */
export function roundCoord(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}
