import { fromBase64, toBase64 } from './base64';

// Pflichttests laut Skill `offgrid-testing`: Hin- und Rückweg, leere Eingabe.

describe('base64', () => {
  it('schreibt bekannte Bytes als Base64', () => {
    expect(toBase64(new TextEncoder().encode('OffGrid'))).toBe('T2ZmR3JpZA==');
  });

  it('kommt über den Hin- und Rückweg auf dieselben Bytes zurück', () => {
    const bytes = new Uint8Array([0, 1, 88, 169, 200, 254, 255]);

    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });

  it('verarbeitet eine leere Eingabe', () => {
    expect(toBase64(new Uint8Array(0))).toBe('');
    expect(fromBase64('')).toEqual(new Uint8Array(0));
  });

  it('verarbeitet auch grosse Puffer in Blöcken', () => {
    const bytes = new Uint8Array(200_000);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = index % 256;
    }

    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });

  it('enthält alle 256 Bytewerte verlustfrei', () => {
    const bytes = new Uint8Array(256);
    for (let wert = 0; wert < 256; wert += 1) {
      bytes[wert] = wert;
    }

    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });
});
