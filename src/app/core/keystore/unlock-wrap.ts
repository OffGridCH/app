import { fromHex } from '../crypto/hex';
import { bufferOf, concat, utf8 } from './bytes';
import { x25519 } from './x25519';

/** Beschriftung des Entsperr-Tokens: `HMAC-SHA256(K_phone, "og-unlock-v1" || device_id_bytes)`. */
export const UNLOCK_TOKEN_LABEL = 'og-unlock-v1';

/** Beschriftung (`info`) des Wrap-Schlüssels. */
export const UNLOCK_WRAP_LABEL = 'og-unlock-wrap-v1';

const DEVICE_ID_PATTERN = /^[0-9A-Fa-f]{12}$/;
const IV_BYTES = 12;
const TOKEN_BYTES = 32;
const TAG_BITS = 128;

/** Die 6 Rohbytes einer `device_id` (12 Hex-Zeichen). */
export function deviceIdBytes(deviceId: string): Uint8Array {
  if (!DEVICE_ID_PATTERN.test(deviceId)) {
    throw new Error('invalid-device-id');
  }
  return fromHex(deviceId);
}

/** Die Bytes, über die der Schlüsselspeicher den HMAC rechnet: `"og-unlock-v1" || device_id_bytes`. */
export function unlockTokenInput(deviceId: string): Uint8Array {
  return concat(utf8(UNLOCK_TOKEN_LABEL), deviceIdBytes(deviceId));
}

/** HMAC-SHA256. */
export async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', bufferOf(key), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, bufferOf(data)));
}

/** `wrap_key = HKDF-SHA256(ikm = shared, salt = nonce, info = "og-unlock-wrap-v1" || device_id_bytes, L = 32)`. */
export async function deriveWrapKey(shared: Uint8Array, nonce: Uint8Array, deviceId: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', bufferOf(shared), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: bufferOf(nonce),
      info: bufferOf(concat(utf8(UNLOCK_WRAP_LABEL), deviceIdBytes(deviceId))),
    },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface WrapInput {
  /** Privater Einmal-Schlüssel der App (32 Byte). */
  appEphPrivate: Uint8Array;
  /** Öffentlicher Einmal-Schlüssel des Geräts aus `sys.hello` (32 Byte). */
  deviceEphPublic: Uint8Array;
  /** Nonce aus `sys.hello` (16 Byte). */
  nonce: Uint8Array;
  deviceId: string;
  /** Das Entsperr-Token (32 Byte). */
  token: Uint8Array;
  /** Zufälliger IV (12 Byte). */
  iv: Uint8Array;
}

/**
 * Packt das Token für `sec.provision`/`sec.unlock` ein.
 *
 * Ergebnis: `iv (12) || AES-256-GCM(wrap_key, token, aad = device_id_bytes)` = 60 Bytes
 * (12 IV + 32 Chiffretext + 16 Tag).
 */
export async function wrapToken(input: WrapInput): Promise<Uint8Array> {
  if (input.token.length !== TOKEN_BYTES || input.iv.length !== IV_BYTES) {
    throw new Error('invalid-wrap-input');
  }
  const shared = x25519(input.appEphPrivate, input.deviceEphPublic);
  const key = await deriveWrapKey(shared, input.nonce, input.deviceId);
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: bufferOf(input.iv),
        additionalData: bufferOf(deviceIdBytes(input.deviceId)),
        tagLength: TAG_BITS,
      },
      key,
      bufferOf(input.token),
    ),
  );
  return concat(input.iv, sealed);
}

export interface UnwrapInput {
  /** Privater Einmal-Schlüssel des Geräts (32 Byte). */
  deviceEphPrivate: Uint8Array;
  /** Öffentlicher Einmal-Schlüssel der App aus `sec.unlock` (32 Byte). */
  appEphPublic: Uint8Array;
  nonce: Uint8Array;
  deviceId: string;
  /** 60 Bytes aus `wrapped_token`. */
  wrapped: Uint8Array;
}

/** Gegenstück zu `wrapToken` (Seite des Geräts, nur im Browser-Mock gebraucht). Wirft bei falscher Sitzung. */
export async function unwrapToken(input: UnwrapInput): Promise<Uint8Array> {
  if (input.wrapped.length !== IV_BYTES + TOKEN_BYTES + TAG_BITS / 8) {
    throw new Error('invalid-wrapped-length');
  }
  const shared = x25519(input.deviceEphPrivate, input.appEphPublic);
  const key = await deriveWrapKey(shared, input.nonce, input.deviceId);
  const plain = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: bufferOf(input.wrapped.slice(0, IV_BYTES)),
      additionalData: bufferOf(deviceIdBytes(input.deviceId)),
      tagLength: TAG_BITS,
    },
    key,
    bufferOf(input.wrapped.slice(IV_BYTES)),
  );
  return new Uint8Array(plain);
}
