import { fromHex, toHex } from './hex';

// Pflichttests laut Skill `offgrid-testing`: Hin- und Rückweg, leere Eingabe.

describe('hex', () => {
  it('schreibt Bytes als Kleinbuchstaben-Hex mit führender Null', () => {
    expect(toHex(new Uint8Array([0, 15, 16, 255]))).toBe('000f10ff');
  });

  it('kommt über den Hin- und Rückweg auf dieselben Bytes zurück', () => {
    const bytes = new Uint8Array([1, 2, 3, 127, 128, 200, 254, 255]);

    expect(fromHex(toHex(bytes))).toEqual(bytes);
  });

  it('verarbeitet einen leeren Puffer', () => {
    expect(toHex(new Uint8Array(0))).toBe('');
    expect(fromHex('')).toEqual(new Uint8Array(0));
  });

  it('liefert 32 Hex-Zeichen für 16 Byte', () => {
    const bytes = new Uint8Array(16).fill(171);

    expect(toHex(bytes)).toHaveLength(32);
    expect(fromHex(toHex(bytes))).toHaveLength(16);
  });

  it('wirft bei ungerader Länge', () => {
    expect(() => fromHex('abc')).toThrow();
  });

  it('wirft bei Zeichen ausserhalb von Hex', () => {
    expect(() => fromHex('zz')).toThrow();
  });
});
