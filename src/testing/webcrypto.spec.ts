// Pflicht laut Skill `offgrid-testing` (Abschnitt „WebCrypto im Test“): In allen Tests muss echtes
// WebCrypto vorhanden sein, weil jsdom kein `crypto.subtle` mitbringt. `src/test-setup.ts` setzt
// dafür die WebCrypto von Node ein. Diese Tests laufen nur grün, wenn das wirklich funktioniert.

const HEX_SHA256_LEER = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

describe('WebCrypto im Test', () => {
  it('stellt globalThis.crypto mit subtle bereit', () => {
    expect(globalThis.crypto).toBeDefined();
    expect(globalThis.crypto.subtle).toBeDefined();
    expect(typeof globalThis.crypto.subtle.digest).toBe('function');
    expect(typeof globalThis.crypto.subtle.importKey).toBe('function');
    expect(typeof globalThis.crypto.subtle.exportKey).toBe('function');
    expect(typeof globalThis.crypto.subtle.encrypt).toBe('function');
    expect(typeof globalThis.crypto.subtle.decrypt).toBe('function');
  });

  it('liefert echte Zufallswerte', () => {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
    expect(bytes).toHaveLength(32);
    expect(bytes.some((byte) => byte !== 0)).toBe(true);
  });

  it('berechnet einen SHA-256-Digest über den leeren String', async () => {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(''));
    expect(digest.byteLength).toBe(32);
    expect(toHex(digest)).toBe(HEX_SHA256_LEER);
  });

  it('verschlüsselt und entschlüsselt mit AES-GCM', async () => {
    const key = await globalThis.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const text = 'Grüezi aus dem Funk';

    const cipher = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
    expect(cipher.byteLength).toBeGreaterThan(text.length);

    const plain = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    expect(new TextDecoder().decode(plain)).toBe(text);
  });

  it('lehnt das Entschlüsseln mit einem falschen Schlüssel ab', async () => {
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const usage = ['encrypt', 'decrypt'] as const;
    const [schluesselA, schluesselB] = await Promise.all([
      globalThis.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [...usage]),
      globalThis.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [...usage]),
    ]);
    const cipher = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      schluesselA,
      new TextEncoder().encode('Geheim'),
    );

    await expect(globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, schluesselB, cipher)).rejects.toBeTruthy();
  });
});