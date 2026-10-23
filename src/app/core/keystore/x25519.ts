/**
 * X25519 (RFC 7748) in TypeScript.
 *
 * Gebraucht, weil `crypto.subtle` X25519 nicht auf jedem Android-WebView kann und die Testvektoren
 * des Vertrags feste Schlüssel verlangen. Gerechnet wird mit `BigInt`; die Schlüssel sind kurzlebig
 * (pro Entsperrversuch einer), darum genügt das.
 */

const P = (1n << 255n) - 19n;
const A24 = 121665n;
const KEY_BYTES = 32;

function decodeLittleEndian(bytes: Uint8Array): bigint {
  let value = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    value = (value << 8n) | BigInt(bytes[i]);
  }
  return value;
}

function encodeLittleEndian(value: bigint): Uint8Array {
  const bytes = new Uint8Array(KEY_BYTES);
  let rest = value;
  for (let i = 0; i < KEY_BYTES; i++) {
    bytes[i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return bytes;
}

function mod(value: bigint): bigint {
  const result = value % P;
  return result >= 0n ? result : result + P;
}

function power(base: bigint, exponent: bigint): bigint {
  let result = 1n;
  let factor = mod(base);
  let rest = exponent;
  while (rest > 0n) {
    if ((rest & 1n) === 1n) {
      result = mod(result * factor);
    }
    factor = mod(factor * factor);
    rest >>= 1n;
  }
  return result;
}

function clampScalar(scalar: Uint8Array): bigint {
  const bytes = new Uint8Array(scalar);
  bytes[0] &= 248;
  bytes[31] &= 127;
  bytes[31] |= 64;
  return decodeLittleEndian(bytes);
}

/** X25519(k, u): Skalarmultiplikation auf der Montgomery-Kurve (Montgomery-Leiter, RFC 7748 §5). */
export function x25519(scalar: Uint8Array, point: Uint8Array): Uint8Array {
  if (scalar.length !== KEY_BYTES || point.length !== KEY_BYTES) {
    throw new Error('x25519-invalid-length');
  }
  const k = clampScalar(scalar);
  const maskedPoint = new Uint8Array(point);
  maskedPoint[31] &= 127;
  const x1 = mod(decodeLittleEndian(maskedPoint));

  let x2 = 1n;
  let z2 = 0n;
  let x3 = x1;
  let z3 = 1n;
  let swap = 0n;

  for (let bit = 254n; bit >= 0n; bit--) {
    const kBit = (k >> bit) & 1n;
    swap ^= kBit;
    if (swap === 1n) {
      [x2, x3] = [x3, x2];
      [z2, z3] = [z3, z2];
    }
    swap = kBit;

    const a = mod(x2 + z2);
    const aa = mod(a * a);
    const b = mod(x2 - z2);
    const bb = mod(b * b);
    const e = mod(aa - bb);
    const c = mod(x3 + z3);
    const d = mod(x3 - z3);
    const da = mod(d * a);
    const cb = mod(c * b);
    const sum = mod(da + cb);
    const difference = mod(da - cb);
    x3 = mod(sum * sum);
    z3 = mod(x1 * mod(difference * difference));
    x2 = mod(aa * bb);
    z2 = mod(e * mod(aa + A24 * e));
  }
  if (swap === 1n) {
    [x2, x3] = [x3, x2];
    [z2, z3] = [z3, z2];
  }

  const result = encodeLittleEndian(mod(x2 * power(z2, P - 2n)));
  if (result.every((byte) => byte === 0)) {
    // Ein Punkt kleiner Ordnung liefert immer 0: das Gerät oder ein Angreifer hat Unsinn geschickt.
    throw new Error('x25519-low-order-point');
  }
  return result;
}

/** Öffentlicher Schlüssel zu einem privaten (Basispunkt u = 9). */
export function x25519PublicKey(privateKey: Uint8Array): Uint8Array {
  const basePoint = new Uint8Array(KEY_BYTES);
  basePoint[0] = 9;
  return x25519(privateKey, basePoint);
}
