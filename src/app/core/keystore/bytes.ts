const encoder = new TextEncoder();

/** WebCrypto verlangt Bytes auf einem `ArrayBuffer`; diese Kopie erfüllt das für jeden `Uint8Array`. */
export function bufferOf(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}

/** Hängt Bytefolgen aneinander. */
export function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

/** Text als UTF-8-Bytes (für die ASCII-Beschriftungen des Vertrags). */
export function utf8(text: string): Uint8Array {
  return encoder.encode(text);
}

/** Zufallsbytes aus dem Betriebssystem. */
export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}
