import { formatDay, formatLastSeen, formatListTime, formatTime } from './time';

// Pflichttests laut Skill `offgrid-testing`: heute, gestern, < 7 Tage, älter; `formatLastSeen` null.
// Feste Zeitpunkte, alle Zeiten in `Europe/Zurich` gerechnet (UTC+2 im Oktober).

const JETZT = new Date('2026-10-22T12:00:00.000Z');

const HEUTE = '2026-10-22T08:05:00.000Z'; // Do 22.10.2026, 10:05
const GESTERN = '2026-10-21T08:05:00.000Z'; // Mi 21.10.2026, 10:05
const DREI_TAGE = '2026-10-19T08:05:00.000Z'; // Mo 19.10.2026, 10:05
const SECHS_TAGE = '2026-10-16T08:05:00.000Z'; // Fr 16.10.2026, 10:05
const ALT = '2026-07-05T08:05:00.000Z'; // So 05.07.2026, 10:05

describe('formatTime', () => {
  it('schreibt die Uhrzeit im 24-Stunden-Format', () => {
    expect(formatTime(HEUTE)).toBe('10:05');
    expect(formatTime(ALT)).toBe('10:05');
  });
});

describe('formatListTime', () => {
  it('schreibt heute nur die Uhrzeit', () => {
    expect(formatListTime(HEUTE, JETZT)).toBe('10:05');
  });

  it('schreibt für gestern „Gestern“', () => {
    expect(formatListTime(GESTERN, JETZT)).toBe('Gestern');
  });

  it('schreibt innerhalb von 7 Tagen den kurzen Wochentag', () => {
    expect(formatListTime(DREI_TAGE, JETZT)).toBe('Mo.');
    expect(formatListTime(SECHS_TAGE, JETZT)).toBe('Fr.');
  });

  it('schreibt ab dem 7. Tag das Datum', () => {
    expect(formatListTime('2026-10-15T08:05:00.000Z', JETZT)).toBe('15.10.26');
    expect(formatListTime(ALT, JETZT)).toBe('05.07.26');
  });
});

describe('formatLastSeen', () => {
  it('schreibt „noch nie empfangen“, wenn noch kein Empfang war', () => {
    expect(formatLastSeen(null, JETZT)).toBe('noch nie empfangen');
  });

  it('schreibt heute „zuletzt“ mit Uhrzeit', () => {
    expect(formatLastSeen(HEUTE, JETZT)).toBe('zuletzt 10:05');
  });

  it('schreibt für gestern „zuletzt gestern“', () => {
    expect(formatLastSeen(GESTERN, JETZT)).toBe('zuletzt gestern');
  });

  it('schreibt sonst „zuletzt“ mit Tag und Monat', () => {
    expect(formatLastSeen(DREI_TAGE, JETZT)).toBe('zuletzt 19.10.');
    expect(formatLastSeen(ALT, JETZT)).toBe('zuletzt 05.07.');
  });
});

describe('formatDay', () => {
  it('schreibt heute „HEUTE“ und gestern „GESTERN“', () => {
    expect(formatDay(HEUTE, JETZT)).toBe('HEUTE');
    expect(formatDay(GESTERN, JETZT)).toBe('GESTERN');
  });

  it('schreibt sonst das vollständige Datum', () => {
    expect(formatDay(DREI_TAGE, JETZT)).toBe('19.10.2026');
    expect(formatDay(ALT, JETZT)).toBe('05.07.2026');
  });
});
