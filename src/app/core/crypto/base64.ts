// Base64-Hilfsfunktionen für das Serial-Protokoll (`p` in `tx`/`rx`).
// Quelle: Skill `offgrid-antenna-protocol` §3 und `offgrid-crypto-handshake` §1.

/** So viele Bytes auf einmal in einen String – schützt vor dem Aufruf-Stack bei grossen Frames. */
const BLOCK = 0x8000;

/** Bytes als Base64-Text. */
export function toBase64(bytes: Uint8Array): string {
  let binaer = '';

  for (let start = 0; start < bytes.length; start += BLOCK) {
    binaer += String.fromCharCode(...bytes.subarray(start, start + BLOCK));
  }
  return btoa(binaer);
}

/** Base64-Text zu Bytes. */
export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binaer = atob(text);
  const bytes = new Uint8Array(binaer.length);

  for (let index = 0; index < binaer.length; index += 1) {
    bytes[index] = binaer.charCodeAt(index);
  }
  return bytes;
}
