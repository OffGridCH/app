// Signalstärke pro Kontakt. Quelle: Skill `offgrid-antenna-protocol` §7, Labels aus `offgrid-screens` §0.

/** Älter als 15 Minuten oder nie gesehen → keine Balken. */
const FRISCH_MINUTEN = 15;

const MINUTE = 60_000;

/** Level 0–4 für `og-signal-bars`. */
export function signalLevel(rssi: number | null, seenAt: string | null, now: Date): 0 | 1 | 2 | 3 | 4 {
  if (seenAt === null || rssi === null) {
    return 0;
  }
  if (now.getTime() - new Date(seenAt).getTime() > FRISCH_MINUTEN * MINUTE) {
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

/** Text für das `aria-label` von `og-signal-bars`. */
export function signalLabel(level: 0 | 1 | 2 | 3 | 4): string {
  switch (level) {
    case 4:
      return 'Signal sehr gut';
    case 3:
      return 'Signal gut';
    case 2:
      return 'Signal mittel';
    case 1:
      return 'Signal schwach';
    case 0:
      return 'Ausser Reichweite';
  }
}
