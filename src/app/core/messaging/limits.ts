const encoder = new TextEncoder();

/** Bytes, die der Text in einem Frame braucht (JSON-Escapes mitgezählt). */
export function contentBytes(text: string): number {
  return encoder.encode(JSON.stringify(text)).length - 2;
}

/** Maximale Textlänge für ein Frame der Grösse `max`. */
export function maxContentBytes(max: number): number {
  return Math.min(180, max - 69);
}

/** Anzeigename: 1–40 Zeichen und höchstens 60 Bytes. */
export function isValidDisplayName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 40) {
    return false;
  }
  return contentBytes(trimmed) <= 60;
}
