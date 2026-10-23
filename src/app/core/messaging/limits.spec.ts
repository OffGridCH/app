import { contentBytes, isValidDisplayName, maxContentBytes, splitText } from './limits';

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
  it('gibt das gemeldete Textlimit unverändert zurück (83 → 83)', () => {
    expect(maxContentBytes(83)).toBe(83);
  });

  it('gibt ein anderes gemeldetes Limit unverändert zurück', () => {
    expect(maxContentBytes(100)).toBe(100);
    expect(maxContentBytes(40)).toBe(40);
    expect(maxContentBytes(222)).toBe(222);
  });
});

describe('splitText', () => {
  it('lässt einen kurzen Text als einen Teil', () => {
    expect(splitText('Hallo', 83)).toEqual(['Hallo']);
  });

  it('ergibt bei leerem oder nur aus Leerzeichen bestehendem Text keine Teile', () => {
    expect(splitText('', 83)).toEqual([]);
    expect(splitText('   ', 83)).toEqual([]);
  });

  it('nimmt genau 83 Bytes in einem Teil an', () => {
    expect(splitText('a'.repeat(83), 83)).toEqual(['a'.repeat(83)]);
  });

  it('teilt 84 Bytes in zwei Teile', () => {
    expect(splitText('a'.repeat(84), 83)).toEqual(['a'.repeat(83), 'a']);
  });

  it('hält jeden Teil unter dem Limit und verliert nichts', () => {
    const text = 'Wir sind bei der Hütte und kommen in etwa 20 Minuten. '.repeat(6).trim();
    const parts = splitText(text, 83);

    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(contentBytes(part)).toBeLessThanOrEqual(83);
    }
    expect(parts.join('')).toBe(text);
  });

  it('trennt nie mitten in einem Zeichen', () => {
    const parts = splitText('ä'.repeat(50), 83);

    expect(parts).toEqual(['ä'.repeat(41), 'ä'.repeat(9)]);
    expect(contentBytes(parts[0])).toBe(82);
  });

  it('lässt Emoji ganz', () => {
    const parts = splitText(`${'a'.repeat(80)}👍🏽`, 83);

    expect(parts).toEqual(['a'.repeat(80), '👍🏽']);
  });

  it('beachtet ein kleineres gemeldetes Limit', () => {
    expect(splitText('abcdef', 4)).toEqual(['abcd', 'ef']);
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
