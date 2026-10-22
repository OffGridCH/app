import { contentBytes, isValidDisplayName, maxContentBytes } from './limits';

// Pflichttests laut Skill `offgrid-testing`: `contentBytes` zählt Umlaute (2 Bytes) und `"` (2 Bytes);
// `maxContentBytes(222)` = 153, `(255)` = 180; `isValidDisplayName`: leer/41 Zeichen/zu viele Bytes → false.

describe('limits', () => {
  describe('contentBytes', () => {
    it('zählt reine ASCII-Zeichen', () => {
      expect(contentBytes('')).toBe(0);
      expect(contentBytes('Hallo')).toBe(5);
    });

    it('zählt Umlaute als 2 Bytes', () => {
      expect(contentBytes('ä')).toBe(2);
      expect(contentBytes('Grüezi')).toBe(7);
    });

    it('zählt Anführungszeichen als 2 Bytes, weil JSON sie escapet', () => {
      expect(contentBytes('"')).toBe(2);
    });

    it('zählt einen Backslash als 2 Bytes', () => {
      expect(contentBytes('\\')).toBe(2);
    });
  });

  describe('maxContentBytes', () => {
    it('nimmt bei 222 Byte den Platz im Frame', () => {
      expect(maxContentBytes(222)).toBe(153);
    });

    it('deckelt bei 180 Byte, auch wenn die Antenne mehr zulässt', () => {
      expect(maxContentBytes(255)).toBe(180);
    });
  });

  describe('isValidDisplayName', () => {
    it('nimmt einen normalen Namen an', () => {
      expect(isValidDisplayName('Anna')).toBe(true);
      expect(isValidDisplayName(' Anna Meier ')).toBe(true);
    });

    it('lehnt einen leeren Namen ab', () => {
      expect(isValidDisplayName('')).toBe(false);
      expect(isValidDisplayName('   ')).toBe(false);
    });

    it('lehnt 41 Zeichen ab', () => {
      expect(isValidDisplayName('a'.repeat(40))).toBe(true);
      expect(isValidDisplayName('a'.repeat(41))).toBe(false);
    });

    it('lehnt Namen mit mehr als 60 Byte ab', () => {
      expect(isValidDisplayName('ü'.repeat(30))).toBe(true);
      expect(isValidDisplayName('ü'.repeat(31))).toBe(false);
    });
  });
});
