import { Injectable } from '@angular/core';

import { fromHex, toHex } from './hex';

const KEY_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 4;
const TAG_LENGTH = 128;

export interface EncryptedData {
  iv: Uint8Array;
  data: Uint8Array;
}

/** Krypto-Basis der App: Schlüssel, Tags und AES-GCM. Nur WebCrypto. */
@Injectable({ providedIn: 'root' })
export class CryptoService {
  private readonly tagCache = new Map<string, string>();

  /** Neuer Schlüssel: 16 Zufallsbytes als 32 Hex-Zeichen in Kleinbuchstaben. */
  newKey(): string {
    return this.randomHex(KEY_BYTES);
  }

  /** Tag eines Schlüssels: erste 4 Bytes von SHA-256 über die 16 Rohbytes (8 Hex-Zeichen). */
  async tag(keyHex: string): Promise<string> {
    const cached = this.tagCache.get(keyHex);
    if (cached !== undefined) {
      return cached;
    }
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', fromHex(keyHex)));
    const tag = toHex(digest.slice(0, TAG_BYTES));
    this.tagCache.set(keyHex, tag);
    return tag;
  }

  /** AES-GCM 128 Bit mit zufälligem IV (12 Bytes) und AAD. */
  async encrypt(keyHex: string, plain: Uint8Array, aad: Uint8Array): Promise<EncryptedData> {
    const key = await this.importKey(keyHex, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const data = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: asBufferSource(aad), tagLength: TAG_LENGTH },
        key,
        asBufferSource(plain),
      ),
    );
    return { iv, data };
  }

  /** Entschlüsselt AES-GCM. Wirft bei falschem Schlüssel oder manipulierten Daten. */
  async decrypt(keyHex: string, iv: Uint8Array, data: Uint8Array, aad: Uint8Array): Promise<Uint8Array> {
    const key = await this.importKey(keyHex, ['decrypt']);
    const plain = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: asBufferSource(iv),
        additionalData: asBufferSource(aad),
        tagLength: TAG_LENGTH,
      },
      key,
      asBufferSource(data),
    );
    return new Uint8Array(plain);
  }

  /** Zufallsbytes als Hex-Text, z. B. 4 Bytes für eine `wireId`. */
  randomHex(bytes: number): string {
    return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
  }

  private importKey(keyHex: string, usages: KeyUsage[]): Promise<CryptoKey> {
    return crypto.subtle.importKey('raw', fromHex(keyHex), { name: 'AES-GCM' }, false, usages);
  }
}

/** WebCrypto verlangt Bytes, die auf einem ArrayBuffer liegen. */
function asBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  if (bytes.buffer instanceof ArrayBuffer) {
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  return new Uint8Array(bytes);
}
