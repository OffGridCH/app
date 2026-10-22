import { TestBed } from '@angular/core/testing';

import { CryptoService } from './crypto.service';
import { toHex } from './hex';

// Pflichttests laut Skill `offgrid-testing`: `newKey` 32 Hex; `encrypt`→`decrypt` gleich;
// falscher Schlüssel wirft; `tag` 8 Hex und stabil.

const SCHLUESSEL_A = '000102030405060708090a0b0c0d0e0f';
const SCHLUESSEL_B = 'f0e1d2c3b4a5968778695a4b3c2d1e0f';

const AAD = new Uint8Array([1, 1, 4, 0, 3]);

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CryptoService);
  });

  it('erzeugt mit newKey 32 Kleinbuchstaben-Hex', () => {
    const key = service.newKey();

    expect(key).toMatch(/^[0-9a-f]{32}$/);
  });

  it('erzeugt bei newKey jedes Mal einen anderen Schlüssel', () => {
    const keys = new Set(Array.from({ length: 20 }, () => service.newKey()));

    expect(keys.size).toBe(20);
  });

  it('liefert mit randomHex die verlangte Zahl Hex-Zeichen', () => {
    expect(service.randomHex(4)).toMatch(/^[0-9a-f]{8}$/);
    expect(service.randomHex(16)).toMatch(/^[0-9a-f]{32}$/);
  });

  it('berechnet den Tag als 8 Hex-Zeichen und bleibt stabil', async () => {
    const tag = await service.tag(SCHLUESSEL_A);

    expect(tag).toMatch(/^[0-9a-f]{8}$/);
    expect(await service.tag(SCHLUESSEL_A)).toBe(tag);
  });

  it('nimmt für den Tag die ersten 4 Byte von SHA-256 über die 16 Rohbytes', async () => {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new Uint8Array(16).map((_, index) => index),
    );

    expect(await service.tag(SCHLUESSEL_A)).toBe(toHex(new Uint8Array(digest).slice(0, 4)));
  });

  it('gibt verschiedenen Schlüsseln verschiedene Tags', async () => {
    expect(await service.tag(SCHLUESSEL_A)).not.toBe(await service.tag(SCHLUESSEL_B));
  });

  it('entschlüsselt mit demselben Schlüssel wieder den Klartext', async () => {
    const plain = new TextEncoder().encode('Grüezi aus dem Funk');
    const { iv, data } = await service.encrypt(SCHLUESSEL_A, plain, AAD);

    expect(iv).toHaveLength(12);
    expect(data).toHaveLength(plain.length + 16);

    const entschluesselt = await service.decrypt(SCHLUESSEL_A, iv, data, AAD);
    expect(Array.from(entschluesselt)).toEqual(Array.from(plain));
  });

  it('verwendet für jeden Aufruf einen neuen IV', async () => {
    const plain = new TextEncoder().encode('Gleicher Text');
    const erst = await service.encrypt(SCHLUESSEL_A, plain, AAD);
    const zweit = await service.encrypt(SCHLUESSEL_A, plain, AAD);

    expect(toHex(zweit.iv)).not.toBe(toHex(erst.iv));
  });

  it('wirft beim Entschlüsseln mit einem anderen Schlüssel', async () => {
    const plain = new TextEncoder().encode('Geheim');
    const { iv, data } = await service.encrypt(SCHLUESSEL_A, plain, AAD);

    await expect(service.decrypt(SCHLUESSEL_B, iv, data, AAD)).rejects.toBeTruthy();
  });

  it('wirft beim Entschlüsseln mit anderer AAD', async () => {
    const plain = new TextEncoder().encode('Geheim');
    const { iv, data } = await service.encrypt(SCHLUESSEL_A, plain, AAD);
    const andereAad = new Uint8Array([9, 9, 9, 9, 9]);

    await expect(service.decrypt(SCHLUESSEL_A, iv, data, andereAad)).rejects.toBeTruthy();
  });

  it('wirft bei beschädigtem Ciphertext', async () => {
    const plain = new TextEncoder().encode('Geheim');
    const { iv, data } = await service.encrypt(SCHLUESSEL_A, plain, AAD);
    const kaputt = new Uint8Array(data);
    kaputt[0] = kaputt[0] ^ 0xff;

    await expect(service.decrypt(SCHLUESSEL_A, iv, kaputt, AAD)).rejects.toBeTruthy();
  });

  it('wirft bei einem Schlüssel, der kein Hex ist', async () => {
    await expect(service.tag('kein-hex')).rejects.toBeTruthy();
  });
});
