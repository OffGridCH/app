import { Injectable } from '@angular/core';

import { bufferOf, randomBytes } from './bytes';
import { KeystoreService } from './keystore.service';

/**
 * Schlüsselspeicher im Arbeitsspeicher (Browser, Tests, Demo).
 *
 * Der Schlüssel entsteht beim ersten Gebrauch zufällig und ist nur so lange da, wie die Seite offen ist.
 * Das ist **kein** Schutz, sondern nur der Ersatz für das Android Keystore ohne Hardware.
 */
@Injectable({ providedIn: 'root' })
export class BrowserKeystoreService extends KeystoreService {
  private key: Promise<CryptoKey> | null = null;

  /** Setzt `K_phone` von Hand (Tests und Testvektoren). */
  useKey(kPhone: Uint8Array): void {
    this.key = this.importKey(kPhone);
  }

  protected async hmac(data: Uint8Array): Promise<Uint8Array> {
    this.key ??= this.importKey(randomBytes(32));
    return new Uint8Array(await crypto.subtle.sign('HMAC', await this.key, bufferOf(data)));
  }

  private importKey(kPhone: Uint8Array): Promise<CryptoKey> {
    // Nicht exportierbar: auch im Browser kommt der Code nach dem Import nicht mehr an die Rohbytes.
    return crypto.subtle.importKey('raw', bufferOf(kPhone), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  }
}
