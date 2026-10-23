import { Injectable } from '@angular/core';

import { fromBase64, toBase64 } from '../crypto/base64';
import { OffgridKeystore } from './keystore.plugin';
import { KeystoreService } from './keystore.service';

/** Schlüsselspeicher über das Android Keystore (nativ). `K_phone` ist darin nicht exportierbar. */
@Injectable({ providedIn: 'root' })
export class AndroidKeystoreService extends KeystoreService {
  protected async hmac(data: Uint8Array): Promise<Uint8Array> {
    const { mac } = await OffgridKeystore.hmac({ data: toBase64(data) });
    const bytes = fromBase64(mac);
    if (bytes.length !== 32) {
      throw new Error('keystore-invalid-mac');
    }
    return bytes;
  }
}
