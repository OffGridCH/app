import { signalLabel, signalLevel } from './signal';

describe('signalLevel', () => {
  const now = new Date('2026-01-15T12:00:00.000Z');
  const seenAt = '2026-01-15T11:55:00.000Z';

  it('ist Level 4 ab -80 dBm', () => {
    expect(signalLevel(-80, seenAt, now)).toBe(4);
    expect(signalLevel(-60, seenAt, now)).toBe(4);
  });

  it('ist Level 3 von -95 bis -81 dBm', () => {
    expect(signalLevel(-95, seenAt, now)).toBe(3);
    expect(signalLevel(-81, seenAt, now)).toBe(3);
  });

  it('ist Level 2 von -105 bis -96 dBm', () => {
    expect(signalLevel(-105, seenAt, now)).toBe(2);
    expect(signalLevel(-96, seenAt, now)).toBe(2);
  });

  it('ist Level 1 von -115 bis -106 dBm', () => {
    expect(signalLevel(-115, seenAt, now)).toBe(1);
    expect(signalLevel(-106, seenAt, now)).toBe(1);
  });

  it('ist Level 0 unter -115 dBm', () => {
    expect(signalLevel(-116, seenAt, now)).toBe(0);
  });

  it('ist Level 0 ohne Kontaktdaten', () => {
    expect(signalLevel(-60, null, now)).toBe(0);
  });

  it('ist Level 0, wenn das Signal älter als 15 Minuten ist', () => {
    const old = new Date(now.getTime() - 16 * 60 * 1000).toISOString();

    expect(signalLevel(-60, old, now)).toBe(0);
  });

  it('bleibt innerhalb von 15 Minuten auf seinem Level', () => {
    const recent = new Date(now.getTime() - 15 * 60 * 1000).toISOString();

    expect(signalLevel(-60, recent, now)).toBe(4);
  });

  it('ist Level 0, wenn das Signal auch nur eine Millisekunde zu alt ist', () => {
    const stale = new Date(now.getTime() - 15 * 60 * 1000 - 1).toISOString();

    expect(signalLevel(-60, stale, now)).toBe(0);
  });
});

describe('signalLabel', () => {
  it('liefert die Texte der Spezifikation', () => {
    expect(signalLabel(4)).toBe('Signal sehr gut');
    expect(signalLabel(3)).toBe('Signal gut');
    expect(signalLabel(2)).toBe('Signal mittel');
    expect(signalLabel(1)).toBe('Signal schwach');
    expect(signalLabel(0)).toBe('Ausser Reichweite');
  });
});
