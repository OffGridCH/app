const HEX_PATTERN = /^[0-9a-fA-F]*$/;

/** Bytes als Hex-Text in Kleinbuchstaben. */
export function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

/** Hex-Text zu Bytes. Wirft bei ungültigem Hex. */
export function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0 || !HEX_PATTERN.test(hex)) {
    throw new Error('invalid-hex');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
