import { fromBase64, toBase64 } from './base64';

describe('base64', () => {
  it('wandelt Bytes in Base64 um', () => {
    expect(toBase64(new TextEncoder().encode('Hello'))).toBe('SGVsbG8=');
  });

  it('wandelt Base64 in Bytes um', () => {
    expect(Array.from(fromBase64('SGVsbG8='))).toEqual([72, 101, 108, 108, 111]);
  });

  it('wandelt hin und zurück ohne Verlust', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255, 128]);
    expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
  });

  it('verarbeitet leere Eingabe', () => {
    expect(toBase64(new Uint8Array(0))).toBe('');
    expect(fromBase64('').length).toBe(0);
  });
});
