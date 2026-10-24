/**
 * Farben des QR-Codes.
 *
 * Das Paket `qrcode` nimmt die Farben nur als String entgegen, deshalb sind dies die
 * einzigen Hex-Werte ausserhalb der Design-Tokens (Skill `offgrid-design-system` §4, og-qr).
 * `QR_DARK` entspricht `--og-bg`, `QR_LIGHT` ist transparent (kein heller Grund).
 */
export const QR_DARK = '#0F1115';

/** Transparenter Grund: die QR-Karte liefert den hellen Hintergrund. */
export const QR_LIGHT = '#00000000';
