import { formatDay, formatLastSeen, formatListTime, formatTime } from './time';

// 15.01.2026, 13:00 Uhr in Europe/Zurich (UTC+1).
const now = new Date('2026-01-15T12:00:00.000Z');

describe('formatTime', () => {
  it('zeigt die Uhrzeit im 24-Stunden-Format', () => {
    expect(formatTime('2026-01-15T08:30:00.000Z')).toBe('09:30');
  });

  it('zeigt Mitternacht als 00:00', () => {
    expect(formatTime('2026-01-14T23:00:00.000Z')).toBe('00:00');
  });

  it('rechnet die Sommerzeit (CEST) ein', () => {
    expect(formatTime('2026-07-15T08:30:00.000Z')).toBe('10:30');
  });
});

describe('formatListTime', () => {
  it('zeigt heute die Uhrzeit', () => {
    expect(formatListTime('2026-01-15T08:30:00.000Z', now)).toBe('09:30');
  });

  it('zeigt gestern „Gestern“', () => {
    expect(formatListTime('2026-01-14T10:00:00.000Z', now)).toBe('Gestern');
  });

  it('zeigt innerhalb von 7 Tagen den kurzen Wochentag', () => {
    expect(formatListTime('2026-01-12T10:00:00.000Z', now)).toBe('Mo.');
  });

  it('zeigt ältere Nachrichten mit Datum', () => {
    expect(formatListTime('2026-01-01T10:00:00.000Z', now)).toBe('01.01.26');
  });

  it('zeigt am 7. Tag noch den Wochentag, am 8. Tag das Datum', () => {
    expect(formatListTime('2026-01-08T10:00:00.000Z', now)).toBe('Do.');
    expect(formatListTime('2026-01-07T10:00:00.000Z', now)).toBe('07.01.26');
  });

  it('rechnet den Kalendertag in Europe/Zurich, nicht in UTC', () => {
    // 23:30 UTC am 14.01. ist in Zürich bereits 00:30 am 15.01. → heute, nicht gestern.
    expect(formatListTime('2026-01-14T23:30:00.000Z', new Date('2026-01-15T00:30:00.000Z'))).toBe('00:30');
  });

  it('trennt die Tage an der Zeitumstellung (Frühling und Herbst)', () => {
    expect(formatListTime('2026-03-29T10:00:00.000Z', new Date('2026-03-30T10:00:00.000Z'))).toBe('Gestern');
    expect(formatListTime('2026-10-24T10:00:00.000Z', new Date('2026-10-25T10:00:00.000Z'))).toBe('Gestern');
  });
});

describe('formatLastSeen', () => {
  it('sagt „noch nie empfangen“, wenn kein Zeitstempel da ist', () => {
    expect(formatLastSeen(null, now)).toBe('noch nie empfangen');
  });

  it('zeigt heute die Uhrzeit', () => {
    expect(formatLastSeen('2026-01-15T08:30:00.000Z', now)).toBe('zuletzt 09:30');
  });

  it('zeigt gestern „zuletzt gestern“', () => {
    expect(formatLastSeen('2026-01-14T10:00:00.000Z', now)).toBe('zuletzt gestern');
  });

  it('zeigt ältere Angaben mit Tag und Monat', () => {
    expect(formatLastSeen('2026-01-01T10:00:00.000Z', now)).toBe('zuletzt 01.01.');
  });

  it('zeigt zwei Angaben am selben Zürcher Tag als „zuletzt <HH:mm>“', () => {
    expect(formatLastSeen('2026-01-14T23:30:00.000Z', new Date('2026-01-15T00:30:00.000Z'))).toBe(
      'zuletzt 00:30',
    );
  });
});

describe('formatDay', () => {
  it('zeigt heute „HEUTE“', () => {
    expect(formatDay('2026-01-15T08:30:00.000Z', now)).toBe('HEUTE');
  });

  it('zeigt gestern „GESTERN“', () => {
    expect(formatDay('2026-01-14T10:00:00.000Z', now)).toBe('GESTERN');
  });

  it('zeigt ältere Tage mit Datum', () => {
    expect(formatDay('2026-01-01T10:00:00.000Z', now)).toBe('01.01.2026');
  });

  it('zeigt gestern an der Zeitumstellung „GESTERN“', () => {
    expect(formatDay('2026-10-24T10:00:00.000Z', new Date('2026-10-25T10:00:00.000Z'))).toBe('GESTERN');
  });
});
