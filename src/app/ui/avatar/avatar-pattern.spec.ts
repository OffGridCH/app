import { avatarPattern } from './avatar-pattern';

describe('avatarPattern', () => {
  it('liefert 25 Werte', () => {
    expect(avatarPattern(11)).toHaveLength(25);
  });

  it('ist spiegelsymmetrisch (Spalte 0 gleich 4, Spalte 1 gleich 3)', () => {
    const pattern = avatarPattern(58);

    for (let row = 0; row < 5; row++) {
      const offset = row * 5;
      expect(pattern[offset]).toBe(pattern[offset + 4]);
      expect(pattern[offset + 1]).toBe(pattern[offset + 3]);
    }
  });

  it('liefert für denselben Seed dasselbe Raster', () => {
    expect(avatarPattern(203)).toEqual(avatarPattern(203));
  });

  it('liefert für verschiedene Seeds verschiedene Raster', () => {
    expect(avatarPattern(11)).not.toEqual(avatarPattern(58));
  });

  it('schaltet mindestens fünf Zellen an', () => {
    for (const seed of [0, 1, 7, 11, 58, 203, 999, 123456]) {
      const pattern = avatarPattern(seed);
      const active = pattern.filter((cell) => cell).length;
      expect(active).toBeGreaterThanOrEqual(5);
    }
  });
});
