import { Injectable } from '@angular/core';

import { fromHex, toHex } from './hex';

// Krypto nur über WebCrypto, keine Bibliotheken. Quelle: Skill `offgrid-crypto-handshake` §1.

/** Länge eines Schlüssels in Bytes (32 Hex-Zeichen, passt zu `CHAR(32)` im ERD). */
const SCHLUESSEL_BYTES = 16;

/** Länge der Initialisierungsvektors in Bytes. */
const IV_BYTES = 12;

/** Länge der Authentifizierungstag in Bit. */
const TAG_BIT = 128;

/**
 * WebCrypto nimmt nur Bytes, die an einem `ArrayBuffer` hängen. Ein `Uint8Array` aus dem
 * Quelltext kann auch auf einem `SharedArrayBuffer` liegen, deshalb wird hier notfalls kopiert.
 */
function webCryptoBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const puffer = bytes.buffer;

  return puffer instanceof ArrayBuffer
    ? new Uint8Array(puffer, bytes.byteOffset, bytes.byteLength)
    : new Uint8Array(bytes);
}

@Injectable({ providedIn: 'root' })
export class CryptoService {
  private readonly tagCache = new Map<string, Promise<string>>();
  private readonly keyCache = new Map<string, Promise<CryptoKey>>();

  /** 16 Zufallsbytes als 32 Zeichen Kleinbuchstaben-Hex. */
  newKey(): string {
    return this.randomHex(SCHLUESSEL_BYTES);
  }

  /** Zufallsbytes als Hex, z. B. 4 Byte für eine `wireId`. */
  randomHex(bytes: number): string {
    return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
  }

  /** Erste 4 Byte von SHA-256 über die 16 Rohbytes des Schlüssels, als 8 Hex-Zeichen. */
  tag(keyHex: string): Promise<string> {
    const gespeichert = this.tagCache.get(keyHex);
    if (gespeichert !== undefined) {
      return gespeichert;
    }

    const tag = this.berechneTag(keyHex);
    this.tagCache.set(keyHex, tag);
    return tag;
  }

  /** AES-GCM 128 Bit mit 12 Byte IV und 128 Bit Tag. `aad` wird nicht mitverschlüsselt, aber authentifiziert. */
  async encrypt(
    keyHex: string,
    plain: Uint8Array,
    aad: Uint8Array,
  ): Promise<{ iv: Uint8Array<ArrayBuffer>; data: Uint8Array<ArrayBuffer> }> {
    const key = await this.cryptoKey(keyHex);
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: webCryptoBytes(aad), tagLength: TAG_BIT },
      key,
      webCryptoBytes(plain),
    );

    return { iv, data: new Uint8Array(cipher) };
  }

  /** Entschlüsselt; wirft bei falschem Schlüssel, falscher AAD oder beschädigtem Ciphertext. */
  async decrypt(keyHex: string, iv: Uint8Array, data: Uint8Array, aad: Uint8Array): Promise<Uint8Array> {
    const key = await this.cryptoKey(keyHex);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: webCryptoBytes(iv), additionalData: webCryptoBytes(aad), tagLength: TAG_BIT },
      key,
      webCryptoBytes(data),
    );

    return new Uint8Array(plain);
  }

  private async berechneTag(keyHex: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', fromHex(keyHex));
    return toHex(new Uint8Array(digest).slice(0, 4));
  }

  private cryptoKey(keyHex: string): Promise<CryptoKey> {
    const gespeichert = this.keyCache.get(keyHex);
    if (gespeichert !== undefined) {
      return gespeichert;
    }

    const key = crypto.subtle.importKey(
      'raw',
      fromHex(keyHex),
      { name: 'AES-GCM', length: SCHLUESSEL_BYTES * 8 },
      false,
      ['encrypt', 'decrypt'],
    );
    this.keyCache.set(keyHex, key);
    return key;
  }
}
