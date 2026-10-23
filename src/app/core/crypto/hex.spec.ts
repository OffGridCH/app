import { fromHex, toHex } from './hex';

describe('hex', () => {
  it('wandelt Bytes in Hex-Text um', () => {
    expect(toHex(new Uint8Array([0x00, 0x0f, 0xa5, 0xff]))).toBe('000fa5ff');
  });

  it('wandelt Hex-Text in Bytes um', () => {
    expect(Array.from(fromHex('000fa5ff'))).toEqual([0, 15, 165, 255]);
  });

  it('wandelt hin und zurück ohne Verlust', () => {
    const bytes = new Uint8Array([1, 2, 3, 250, 255, 0]);
    expect(Array.from(fromHex(toHex(bytes)))).toEqual(Array.from(bytes));
  });

  it('verarbeitet leere Eingabe', () => {
    expect(toHex(new Uint8Array(0))).toBe('');
    expect(fromHex('').length).toBe(0);
  });

  it('schreibt Hex in Kleinbuchstaben', () => {
    expect(toHex(new Uint8Array([0xab, 0xcd]))).toBe('abcd');
  });

  it('wirft bei ungültigem Hex', () => {
    expect(() => fromHex('0g')).toThrow();
    expect(() => fromHex('abc')).toThrow();
  });
});
