// Hex-Hilfsfunktionen. Quelle: Skill `offgrid-crypto-handshake` §1.

const HEX_MUSTER = /^[0-9a-f]*$/i;

/** Bytes als Kleinbuchstaben-Hex, z. B. `[0, 255]` → „00ff“. */
export function toHex(bytes: Uint8Array): string {
  let hex = '';

  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

/** Hex zu Bytes. Wirft bei ungerader Länge oder Zeichen ausserhalb 0–9/a–f. */
export function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0 || !HEX_MUSTER.test(hex)) {
    throw new Error('invalid-hex');
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}
