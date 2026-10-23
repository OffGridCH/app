const encoder = new TextEncoder();

/**
 * Geräte-Textlimit aus OffGrid Link §7.5 (`limits.max_text_bytes`, Standardwert).
 */
const MAX_TEXT_BYTES = 83;

/**
 * Frame-Overhead laut `docs/esp-schnittstelle.md` §8:
 * 1 Byte Version/Typ + 4 Byte Empfänger-Tag + 12 Byte IV + 16 Byte Auth-Tag.
 */
const FRAME_OVERHEAD = 33;

/**
 * Maximale Länge eines Anzeigenamens in UTF-8-Bytes laut OffGrid Link §7.2/§7.3
 * (`sec.provision` und `id.set_name`).
 */
const MAX_NAME_BYTES = 24;

/** UTF-8-Bytelänge des Textes (ohne JSON-Escapes). */
export function contentBytes(text: string): number {
  return encoder.encode(text).length;
}

/** Maximale Textlänge für ein Frame der Grösse `max`, gedeckelt durch das Geräte-Textlimit. */
export function maxContentBytes(max: number): number {
  return Math.min(MAX_TEXT_BYTES, max - FRAME_OVERHEAD);
}

/** Anzeigename: 1–24 UTF-8-Bytes. */
export function isValidDisplayName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return false;
  }
  return contentBytes(trimmed) <= MAX_NAME_BYTES;
}
