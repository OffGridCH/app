import { contentBytes, isValidDisplayName, maxContentBytes } from './limits';

describe('contentBytes', () => {
  it('zählt Umlaute als 2 Bytes', () => {
    expect(contentBytes('ä')).toBe(2);
  });

  it('zählt Anführungszeichen als 1 Byte (keine JSON-Escapes)', () => {
    expect(contentBytes('"')).toBe(1);
  });

  it('zählt leeren Text als 0 Bytes', () => {
    expect(contentBytes('')).toBe(0);
  });

  it('zählt einfache Zeichen als 1 Byte', () => {
    expect(contentBytes('abc')).toBe(3);
  });

  it('zählt Zeilenumbruch als 1 Byte (ohne JSON-Escape)', () => {
    expect(contentBytes('a\nb')).toBe(3);
  });

  it('zählt Anführungszeichen im Text ohne JSON-Escape als je 1 Byte', () => {
    expect(contentBytes('a"b')).toBe(3);
  });
});

describe('maxContentBytes', () => {
  it('deckelt beim Geräte-Textlimit von 83 Bytes', () => {
    expect(maxContentBytes(222)).toBe(83);
    expect(maxContentBytes(255)).toBe(83);
    expect(maxContentBytes(249)).toBe(83);
  });

  it('rechnet bei kleineren Frames mit 33 Bytes Frame-Overhead', () => {
    expect(maxContentBytes(100)).toBe(67);
  });

  it('respektiert das Gerätelimit und den Frame-Overhead für jede Frame-Grösse', () => {
    for (const max of [100, 150, 222, 249, 255]) {
      const limit = maxContentBytes(max);

      expect(limit).toBe(Math.min(83, max - 33));
      expect(limit + 33).toBeLessThanOrEqual(max);
    }
  });
});

describe('isValidDisplayName', () => {
  it('lehnt leere Namen ab', () => {
    expect(isValidDisplayName('')).toBe(false);
    expect(isValidDisplayName('   ')).toBe(false);
  });

  it('lehnt Namen mit mehr als 24 Bytes ab', () => {
    expect(isValidDisplayName('a'.repeat(25))).toBe(false);
  });

  it('nimmt Namen mit genau 24 Bytes an', () => {
    expect(isValidDisplayName('a'.repeat(24))).toBe(true);
  });

  it('zählt Umlaute als 2 Bytes', () => {
    expect(isValidDisplayName('ä'.repeat(12))).toBe(true);
    expect(isValidDisplayName('ä'.repeat(13))).toBe(false);
  });

  it('zählt nach dem Trimmen', () => {
    expect(isValidDisplayName('  Anna  ')).toBe(true);
    expect(isValidDisplayName(`  ${'a'.repeat(25)}  `)).toBe(false);
  });

  it('nimmt normale Namen an', () => {
    expect(isValidDisplayName('Anna')).toBe(true);
  });
});
