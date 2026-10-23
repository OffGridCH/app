import { registerPlugin } from '@capacitor/core';

/**
 * Schnittstelle des nativen Capacitor-Plugins `OffgridKeystore` (Kotlin, kommt mit T06).
 *
 * Das Plugin legt beim ersten Aufruf einen HMAC-SHA256-Schlüssel mit dem Alias `offgrid_unlock` im
 * Android Keystore an (Zweck `PURPOSE_SIGN`, nicht exportierbar) und rechnet nur den HMAC.
 * Mehr kann und darf es nicht: X25519, HKDF und AES-GCM laufen in TypeScript.
 */
export interface OffgridKeystorePlugin {
  /** `HMAC-SHA256(K_phone, data)`; `data` und das Ergebnis sind Base64. */
  hmac(options: { data: string }): Promise<{ mac: string }>;
}

export const OffgridKeystore = registerPlugin<OffgridKeystorePlugin>('OffgridKeystore');
