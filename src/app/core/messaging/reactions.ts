/**
 * Emoji-Tabelle der Reaktionen (Offgrid Protocol v1, Appendix B).
 *
 * Auf der Leitung zur App steht das Emoji selbst; die Indizes `0x01` bis `0x06` kennt nur das Gerät.
 * `0x00` heisst „Reaktion entfernen“ und wird mit `emoji: null` gesendet.
 */
export const REACTION_EMOJIS: readonly string[] = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

/** Ist das Emoji in der Tabelle? */
export function isReactionEmoji(value: string): boolean {
  return REACTION_EMOJIS.includes(value);
}
