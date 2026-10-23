import { contentBytes, isValidDisplayName, maxContentBytes } from './limits';

describe('contentBytes', () => {
  it('zählt Umlaute als 2 Bytes', () => {
    expect(contentBytes('ä')).toBe(2);
  });

  it('zählt Anführungszeichen als 2 Bytes', () => {
    expect(contentBytes('"')).toBe(2);
  });

  it('zählt leeren Text als 0 Bytes', () => {
    expect(contentBytes('')).toBe(0);
  });

  it('zählt einfache Zeichen als 1 Byte', () => {
    expect(contentBytes('abc')).toBe(3);
  });

  it('zählt JSON-Escapes mit (Zeilenumbruch und Anführungszeichen)', () => {
    expect(contentBytes('a\nb')).toBe(4);
    expect(contentBytes('a"b')).toBe(4);
  });
});

describe('maxContentBytes', () => {
  it('rechnet bei 222 Frame-Bytes', () => {
    expect(maxContentBytes(222)).toBe(153);
  });

  it('deckelt bei 180 Bytes', () => {
    expect(maxContentBytes(255)).toBe(180);
  });

  it('rechnet bei kleineren Frames mit 69 Bytes Overhead', () => {
    expect(maxContentBytes(100)).toBe(31);
    expect(maxContentBytes(249)).toBe(180);
  });
});

describe('isValidDisplayName', () => {
  it('lehnt leere Namen ab', () => {
    expect(isValidDisplayName('')).toBe(false);
    expect(isValidDisplayName('   ')).toBe(false);
  });

  it('lehnt mehr als 40 Zeichen ab', () => {
    expect(isValidDisplayName('a'.repeat(41))).toBe(false);
  });

  it('nimmt 40 Zeichen an', () => {
    expect(isValidDisplayName('a'.repeat(40))).toBe(true);
  });

  it('lehnt Namen mit mehr als 60 Bytes ab', () => {
    expect(isValidDisplayName('ä'.repeat(31))).toBe(false);
  });

  it('nimmt Namen mit genau 60 Bytes an', () => {
    expect(isValidDisplayName('ä'.repeat(30))).toBe(true);
  });

  it('zählt nach dem Trimmen', () => {
    expect(isValidDisplayName('  Anna  ')).toBe(true);
    expect(isValidDisplayName(`  ${'a'.repeat(41)}  `)).toBe(false);
  });

  it('nimmt normale Namen an', () => {
    expect(isValidDisplayName('Anna')).toBe(true);
  });
});
