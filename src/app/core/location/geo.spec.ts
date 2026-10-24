import { formatListTime } from '../format/time';
import {
  bearingDegrees,
  compassName,
  distanceMeters,
  formatAgo,
  formatAccuracy,
  formatCoordinate,
  formatCoordinatePlain,
  formatDistance,
  roundCoord,
} from './geo';

/** Luzern, der Startpunkt der Demo. */
const START = { latitude: 47.05021, longitude: 8.30934 };

describe('geo', () => {
  describe('distanceMeters', () => {
    it('misst die Strecke nach Zürich', () => {
      const distance = distanceMeters(START, { latitude: 47.37689, longitude: 8.54169 });
      expect(distance).toBeGreaterThan(40_242);
      expect(distance).toBeLessThan(40_442);
    });

    it('misst die Strecke zum Demo-Kontakt', () => {
      const distance = distanceMeters(START, { latitude: 47.05812, longitude: 8.31998 });
      expect(distance).toBeGreaterThan(1188);
      expect(distance).toBeLessThan(1198);
    });

    it('misst zwischen einem Punkt und sich selbst 0', () => {
      expect(distanceMeters(START, START)).toBe(0);
    });
  });

  describe('bearingDegrees', () => {
    it('zeigt nach Norden als 0', () => {
      expect(bearingDegrees(START, { latitude: 47.15, longitude: 8.30934 })).toBeCloseTo(0, 3);
    });

    it('zeigt nach Osten als 90', () => {
      expect(bearingDegrees(START, { latitude: 47.05021, longitude: 8.40934 })).toBeCloseTo(90, 1);
    });

    it('zeigt zum Demo-Kontakt nach Nordosten', () => {
      expect(bearingDegrees(START, { latitude: 47.05812, longitude: 8.31998 })).toBeCloseTo(42.5, 1);
    });
  });

  describe('compassName', () => {
    it('nennt die acht Richtungen', () => {
      expect(compassName(0)).toBe('Norden');
      expect(compassName(45)).toBe('Nordosten');
      expect(compassName(90)).toBe('Osten');
      expect(compassName(135)).toBe('Südosten');
      expect(compassName(180)).toBe('Süden');
      expect(compassName(225)).toBe('Südwesten');
      expect(compassName(270)).toBe('Westen');
      expect(compassName(315)).toBe('Nordwesten');
    });

    it('nimmt die Richtung an der Grenze richtig', () => {
      expect(compassName(22.4)).toBe('Norden');
      expect(compassName(22.6)).toBe('Nordosten');
    });

    it('nennt Norden auch bei 359 Grad', () => {
      expect(compassName(359)).toBe('Norden');
    });
  });

  describe('formatDistance', () => {
    it('zeigt unter einem Kilometer in Metern', () => {
      expect(formatDistance(849)).toBe('850 m');
      expect(formatDistance(0)).toBe('0 m');
      expect(formatDistance(12)).toBe('10 m');
    });

    it('zeigt über einem Kilometer mit einer Nachkommastelle', () => {
      expect(formatDistance(996)).toBe('1.0 km');
      expect(formatDistance(1234)).toBe('1.2 km');
    });

    it('zeigt ab 10 Kilometern ganzzahlig', () => {
      expect(formatDistance(9990)).toBe('10 km');
      expect(formatDistance(12345)).toBe('12 km');
    });
  });

  describe('formatCoordinate', () => {
    it('zeigt Breite und Länge mit Hemisphäre', () => {
      expect(formatCoordinate(47.05021, 8.30934)).toBe('47.05021° N, 8.30934° O');
    });

    it('zeigt Süden und Westen', () => {
      expect(formatCoordinate(-33.9, -70.6)).toBe('33.90000° S, 70.60000° W');
    });
  });

  describe('formatCoordinatePlain', () => {
    it('zeigt die Koordinate ohne Hemisphäre', () => {
      expect(formatCoordinatePlain(47.05021, 8.30934)).toBe('47.05021, 8.30934');
    });
  });

  describe('formatAccuracy', () => {
    it('zeigt die Genauigkeit in Metern', () => {
      expect(formatAccuracy(8)).toBe('±8 m');
      expect(formatAccuracy(8.6)).toBe('±9 m');
    });

    it('zeigt mindestens 1 Meter', () => {
      expect(formatAccuracy(0)).toBe('±1 m');
      expect(formatAccuracy(0.2)).toBe('±1 m');
    });
  });

  describe('formatAgo', () => {
    const now = new Date('2026-10-24T12:00:00.000Z');
    const ago = (ms: number): string => new Date(now.getTime() - ms).toISOString();

    it('zeigt eine frische Position als „gerade eben“', () => {
      expect(formatAgo(now.toISOString(), now)).toBe('gerade eben');
      expect(formatAgo(ago(30_000), now)).toBe('gerade eben');
    });

    it('zeigt Minuten', () => {
      expect(formatAgo(ago(60_000), now)).toBe('vor 1 Min.');
      expect(formatAgo(ago(12 * 60_000), now)).toBe('vor 12 Min.');
      expect(formatAgo(ago(59 * 60_000), now)).toBe('vor 59 Min.');
    });

    it('zeigt Stunden', () => {
      expect(formatAgo(ago(60 * 60_000), now)).toBe('vor 1 Std.');
      expect(formatAgo(ago(23 * 3_600_000), now)).toBe('vor 23 Std.');
    });

    it('zeigt ab einem Tag das Listenformat', () => {
      const iso = ago(25 * 3_600_000);
      expect(formatAgo(iso, now)).toBe(formatListTime(iso, now));
    });
  });

  describe('roundCoord', () => {
    it('rundet auf sechs Nachkommastellen', () => {
      expect(roundCoord(47.0502109)).toBe(47.050211);
      expect(roundCoord(8.3)).toBe(8.3);
    });
  });
});
