export type SignalLevel = 0 | 1 | 2 | 3 | 4;

const STALE_MS = 15 * 60 * 1000;

/**
 * Signal-Level eines Kontakts.
 * Ohne Kontaktdaten (kein `seenAt`) oder bei einem Signal, das älter als 15 Minuten ist, ist der Level 0.
 */
export function signalLevel(rssi: number | null, seenAt: string | null, now: Date): SignalLevel {
  if (rssi === null || seenAt === null) {
    return 0;
  }
  const age = now.getTime() - new Date(seenAt).getTime();
  if (age > STALE_MS) {
    return 0;
  }
  if (rssi >= -80) {
    return 4;
  }
  if (rssi >= -95) {
    return 3;
  }
  if (rssi >= -105) {
    return 2;
  }
  if (rssi >= -115) {
    return 1;
  }
  return 0;
}

/** Sichtbarer Text zum Signal-Level (aria-label von `og-signal-bars`). */
export function signalLabel(level: SignalLevel): string {
  switch (level) {
    case 4:
      return 'Signal sehr gut';
    case 3:
      return 'Signal gut';
    case 2:
      return 'Signal mittel';
    case 1:
      return 'Signal schwach';
    default:
      return 'Ausser Reichweite';
  }
}
