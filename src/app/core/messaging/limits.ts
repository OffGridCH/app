// Längen der Funkinhalte. Quelle: Skill `offgrid-antenna-protocol` §5 („Längen“).

/** Platz, den ein Text im Klartext-JSON braucht (die zwei Anführungszeichen zählen nicht mit). */
export function contentBytes(text: string): number {
  return new TextEncoder().encode(JSON.stringify(text)).length - 2;
}

/**
 * Grösster Text, der noch in einen Frame passt.
 * 69 = 33 Byte Frame-Overhead + 36 Byte JSON-Hülle ohne Text.
 */
export function maxContentBytes(max: number): number {
  return Math.min(180, max - 69);
}

/**
 * Anzeigename: höchstens 40 Zeichen **und** höchstens 60 Byte, damit `hs`-Frames immer passen.
 */
export function isValidDisplayName(name: string): boolean {
  const nameGetrimmt = name.trim();

  if (nameGetrimmt.length === 0 || nameGetrimmt.length > 40) {
    return false;
  }
  return contentBytes(nameGetrimmt) <= 60;
}
