import { TestBed } from '@angular/core/testing';

import { CryptoService } from './crypto.service';
import { fromHex, toHex } from './hex';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [CryptoService] });
    service = TestBed.inject(CryptoService);
  });

  it('erzeugt einen neuen Schlüssel mit 32 Hex-Zeichen', () => {
    const key = service.newKey();
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(service.newKey()).not.toBe(key);
  });

  it('erzeugt Zufalls-Hex in der gewünschten Länge', () => {
    expect(service.randomHex(4)).toMatch(/^[0-9a-f]{8}$/);
    expect(service.randomHex(16)).toMatch(/^[0-9a-f]{32}$/);
  });

  it('verschlüsselt und entschlüsselt denselben Klartext', async () => {
    const key = service.newKey();
    const plain = new TextEncoder().encode('Grüezi');
    const aad = new TextEncoder().encode('aad');

    const { iv, data } = await service.encrypt(key, plain, aad);
    const decrypted = await service.decrypt(key, iv, data, aad);

    expect(Array.from(decrypted)).toEqual(Array.from(plain));
  });

  it('verwendet für jede Verschlüsselung einen neuen IV', async () => {
    const key = service.newKey();
    const plain = new TextEncoder().encode('Hallo');
    const aad = new Uint8Array(0);

    const first = await service.encrypt(key, plain, aad);
    const second = await service.encrypt(key, plain, aad);

    expect(Array.from(first.iv)).toHaveLength(12);
    expect(Array.from(first.iv)).not.toEqual(Array.from(second.iv));
  });

  it('wirft beim Entschlüsseln mit falschem Schlüssel', async () => {
    const key = service.newKey();
    const plain = new TextEncoder().encode('Hallo');
    const aad = new Uint8Array(0);

    const { iv, data } = await service.encrypt(key, plain, aad);

    await expect(service.decrypt(service.newKey(), iv, data, aad)).rejects.toThrow();
  });

  it('wirft beim Entschlüsseln mit falschem AAD', async () => {
    const key = service.newKey();
    const plain = new TextEncoder().encode('Hallo');

    const { iv, data } = await service.encrypt(key, plain, new Uint8Array(0));

    await expect(service.decrypt(key, iv, data, new TextEncoder().encode('anders'))).rejects.toThrow();
  });

  it('berechnet einen stabilen Tag mit 8 Hex-Zeichen', async () => {
    const key = service.newKey();

    const tag = await service.tag(key);

    expect(tag).toMatch(/^[0-9a-f]{8}$/);
    expect(await service.tag(key)).toBe(tag);
  });

  it('berechnet den Tag aus den ersten 4 Bytes von SHA-256 über die Rohbytes', async () => {
    const key = service.newKey();
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', fromHex(key)));

    expect(await service.tag(key)).toBe(toHex(digest.slice(0, 4)));
  });

  it('gibt für verschiedene Schlüssel verschiedene Tags', async () => {
    expect(await service.tag(service.newKey())).not.toBe(await service.tag(service.newKey()));
  });

  it('berechnet den Tag unabhängig von der Instanz gleich', async () => {
    const key = service.newKey();
    const other = new CryptoService();

    expect(await other.tag(key)).toBe(await service.tag(key));
  });
});
