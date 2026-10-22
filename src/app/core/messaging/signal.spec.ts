import { signalLabel, signalLevel } from './signal';

// Pflichttests laut Skill `offgrid-testing`: Grenzwerte -80/-95/-105/-115;
// `seenAt` null → 0; älter 15 min → 0.

const JETZT = new Date('2026-10-22T12:00:00.000Z');

function vor(minuten: number): string {
  return new Date(JETZT.getTime() - minuten * 60_000).toISOString();
}

describe('signalLevel', () => {
  it('gibt 0, wenn noch nie empfangen wurde', () => {
    expect(signalLevel(-60, null, JETZT)).toBe(0);
    expect(signalLevel(null, null, JETZT)).toBe(0);
  });

  it('gibt 0, wenn kein RSSI vorliegt', () => {
    expect(signalLevel(null, vor(1), JETZT)).toBe(0);
  });

  it('gibt 0, wenn der letzte Empfang älter als 15 Minuten her ist', () => {
    expect(signalLevel(-60, vor(16), JETZT)).toBe(0);
    expect(signalLevel(-60, vor(120), JETZT)).toBe(0);
  });

  it('bewertet genau 15 Minuten alten Empfang noch', () => {
    expect(signalLevel(-60, vor(15), JETZT)).toBe(4);
  });

  it('gibt 4 ab -80 dBm', () => {
    expect(signalLevel(-60, vor(1), JETZT)).toBe(4);
    expect(signalLevel(-80, vor(1), JETZT)).toBe(4);
    expect(signalLevel(-81, vor(1), JETZT)).toBe(3);
  });

  it('gibt 3 ab -95 dBm', () => {
    expect(signalLevel(-95, vor(1), JETZT)).toBe(3);
    expect(signalLevel(-96, vor(1), JETZT)).toBe(2);
  });

  it('gibt 2 ab -105 dBm', () => {
    expect(signalLevel(-105, vor(1), JETZT)).toBe(2);
    expect(signalLevel(-106, vor(1), JETZT)).toBe(1);
  });

  it('gibt 1 ab -115 dBm', () => {
    expect(signalLevel(-115, vor(1), JETZT)).toBe(1);
    expect(signalLevel(-116, vor(1), JETZT)).toBe(0);
  });
});

describe('signalLabel', () => {
  it('nennt jeden Level mit seinem Text aus dem Skill', () => {
    expect(signalLabel(4)).toBe('Signal sehr gut');
    expect(signalLabel(3)).toBe('Signal gut');
    expect(signalLabel(2)).toBe('Signal mittel');
    expect(signalLabel(1)).toBe('Signal schwach');
    expect(signalLabel(0)).toBe('Ausser Reichweite');
  });
});
