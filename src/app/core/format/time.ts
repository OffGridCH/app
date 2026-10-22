// Zeit- und Datumsformate der App. Quelle: Skill `offgrid-screens` §0.
// Alle Formate laufen über `Intl.DateTimeFormat('de-CH', …)` in der Zeitzone `Europe/Zurich`.
// Die Seiten übergeben `new Date()` als `now`.

const ZEITZONE = 'Europe/Zurich';

const zeitFormat = new Intl.DateTimeFormat('de-CH', {
  timeZone: ZEITZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const tagFormat = new Intl.DateTimeFormat('de-CH', {
  timeZone: ZEITZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const tagMonatFormat = new Intl.DateTimeFormat('de-CH', {
  timeZone: ZEITZONE,
  day: '2-digit',
  month: '2-digit',
});

const tagKurzFormat = new Intl.DateTimeFormat('de-CH', {
  timeZone: ZEITZONE,
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
});

const wochentagFormat = new Intl.DateTimeFormat('de-CH', {
  timeZone: ZEITZONE,
  weekday: 'short',
});

const MILLI_PRO_TAG = 86_400_000;

/**
 * Tagesnummer des Kalendertags in der Zeitzone `Europe/Zurich`.
 * Damit wird „heute“, „gestern“ und „innerhalb von 7 Tagen“ auch dann richtig
 * entschieden, wenn die Nachricht um Mitternacht UTC angezeigt wird.
 */
function tagesNummer(datum: Date): number {
  const [tag, monat, jahr] = tagFormat.format(datum).split('.');
  return Date.UTC(Number(jahr), Number(monat) - 1, Number(tag)) / MILLI_PRO_TAG;
}

/** `HH:mm` im 24-Stunden-Format. */
export function formatTime(iso: string): string {
  return zeitFormat.format(new Date(iso));
}

/** Listenzeit: heute `HH:mm`, gestern „Gestern“, < 7 Tage Wochentag kurz („Mo.“), sonst `dd.MM.yy`. */
export function formatListTime(iso: string, now: Date): string {
  const datum = new Date(iso);
  const tage = tagesNummer(now) - tagesNummer(datum);

  if (tage === 0) {
    return zeitFormat.format(datum);
  }
  if (tage === 1) {
    return 'Gestern';
  }
  if (tage > 1 && tage < 7) {
    // Schweizer Kürzel mit Punkt, z. B. „Mo.“.
    return `${wochentagFormat.format(datum)}.`;
  }
  return tagKurzFormat.format(datum);
}

/** „zuletzt <HH:mm>“, „zuletzt gestern“, „zuletzt <dd.MM.>“ oder „noch nie empfangen“. */
export function formatLastSeen(iso: string | null, now: Date): string {
  if (iso === null) {
    return 'noch nie empfangen';
  }

  const datum = new Date(iso);
  const tage = tagesNummer(now) - tagesNummer(datum);

  if (tage === 0) {
    return `zuletzt ${zeitFormat.format(datum)}`;
  }
  if (tage === 1) {
    return 'zuletzt gestern';
  }
  return `zuletzt ${tagMonatFormat.format(datum)}`;
}

/** Tagestrenner im Chat: „HEUTE“, „GESTERN“ oder `dd.MM.yyyy`. */
export function formatDay(iso: string, now: Date): string {
  const datum = new Date(iso);
  const tage = tagesNummer(now) - tagesNummer(datum);

  if (tage === 0) {
    return 'HEUTE';
  }
  if (tage === 1) {
    return 'GESTERN';
  }
  return tagFormat.format(datum);
}
