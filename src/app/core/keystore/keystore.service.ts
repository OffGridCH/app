import { fromBase64, toBase64 } from '../crypto/base64';
import type { DeviceSession } from '../models/device';
import { randomBytes } from './bytes';
import { unlockTokenInput, wrapToken } from './unlock-wrap';
import { x25519PublicKey } from './x25519';

/** Das, was `sec.provision` und `sec.unlock` brauchen (beides Base64). */
export interface UnlockEnvelope {
  /** Öffentlicher Einmal-Schlüssel der App (32 Byte). */
  appEphPub: string;
  /** 60 Bytes: IV, Chiffretext und Tag. */
  wrappedToken: string;
}

/** Zufallswerte eines Entsperrversuchs. Nur Tests setzen sie von Hand. */
export interface UnlockRandomness {
  appEphPrivate: Uint8Array;
  iv: Uint8Array;
}

/**
 * Das Entsperr-Geheimnis der App.
 *
 * `K_phone` verlässt den Schlüsselspeicher nie. Die App darf ihn nur bitten, einen HMAC damit zu rechnen.
 * Daraus wird das Token pro Gerät: `HMAC-SHA256(K_phone, "og-unlock-v1" || device_id_bytes)`.
 * Das Token geht nie unverpackt über das Kabel, sondern nur als `wrapped_token` (Skill `offgrid-crypto-handshake`).
 *
 * Abstrakte Klasse, damit sie als DI-Token dienen kann: Android nutzt das native Keystore,
 * der Browser einen Schlüssel im Arbeitsspeicher.
 */
export abstract class KeystoreService {
  /** `HMAC-SHA256(K_phone, data)`. Der Schlüssel bleibt im Schlüsselspeicher. */
  protected abstract hmac(data: Uint8Array): Promise<Uint8Array>;

  /** Das Entsperr-Token für ein Gerät (32 Bytes). */
  async unlockToken(deviceId: string): Promise<Uint8Array> {
    return this.hmac(unlockTokenInput(deviceId));
  }

  /**
   * Baut Einmal-Schlüssel und `wrapped_token` für eine Sitzung aus `sys.hello`.
   *
   * Die Sitzung ist einmalig: nach jedem Versuch, ob erfolgreich oder nicht, braucht es ein neues `sys.hello`.
   */
  async createUnlockEnvelope(
    session: DeviceSession,
    deviceId: string,
    randomness?: UnlockRandomness,
  ): Promise<UnlockEnvelope> {
    const token = await this.unlockToken(deviceId);
    const appEphPrivate = randomness?.appEphPrivate ?? randomBytes(32);
    const iv = randomness?.iv ?? randomBytes(12);
    const wrapped = await wrapToken({
      appEphPrivate,
      deviceEphPublic: fromBase64(session.deviceEphPub),
      nonce: fromBase64(session.nonce),
      deviceId,
      token,
      iv,
    });
    return { appEphPub: toBase64(x25519PublicKey(appEphPrivate)), wrappedToken: toBase64(wrapped) };
  }
}
