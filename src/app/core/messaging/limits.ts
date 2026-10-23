const encoder = new TextEncoder();

/**
 * Maximale Länge eines Anzeigenamens in UTF-8-Bytes laut Offgrid Host Interface v1
 * (`sec.provision` und `id.set_name`).
 */
const MAX_NAME_BYTES = 24;

/** UTF-8-Bytelänge des Textes (ohne JSON-Escapes). */
export function contentBytes(text: string): number {
  return encoder.encode(text).length;
}

/**
 * Maximale Textlänge in Bytes.
 *
 * Das Gerät meldet sie in `sys.hello` als `limits.max_text_bytes` (Standard 83).
 * Die App rechnet nichts ab und deckelt nichts: Verschlüsselung und Paketaufbau macht das Gerät.
 */
export function maxContentBytes(max: number): number {
  return max;
}

/** Anzeigename: 1–24 UTF-8-Bytes. */
export function isValidDisplayName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return false;
  }
  return contentBytes(trimmed) <= MAX_NAME_BYTES;
}

/** Zerlegt einen Text in Zeichen, die nicht getrennt werden dürfen (Emoji-Sequenzen bleiben ganz). */
function characters(text: string): string[] {
  if (typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter('de', { granularity: 'grapheme' }).segment(text), (part) => part.segment);
  }
  return Array.from(text);
}

/**
 * Teilt einen Text in Teile mit höchstens `maxBytes` UTF-8-Bytes.
 *
 * Es wird nie mitten in einem Zeichen getrennt. Der Text wird vorher getrimmt;
 * leerer Text ergibt keine Teile. Jeder Teil wird als eigene Nachricht gesendet.
 */
export function splitText(text: string, maxBytes: number): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0 || maxBytes < 1) {
    return [];
  }
  const parts: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const character of characters(trimmed)) {
    const bytes = contentBytes(character);
    if (bytes > maxBytes) {
      // Ein einzelnes Zeichen passt nie in eine Nachricht: überspringen statt endlos zu teilen.
      continue;
    }
    if (currentBytes + bytes > maxBytes) {
      parts.push(current);
      current = '';
      currentBytes = 0;
    }
    current += character;
    currentBytes += bytes;
  }
  if (current.length > 0) {
    parts.push(current);
  }
  return parts;
}
