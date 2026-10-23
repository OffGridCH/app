import { TestBed } from '@angular/core/testing';

import { fromBase64, toBase64 } from '../crypto/base64';
import { fromHex, toHex } from '../crypto/hex';
import { BrowserKeystoreService } from './browser-keystore.service';
import { unwrapToken } from './unlock-wrap';
import { x25519PublicKey } from './x25519';

const DEVICE_ID = '7CDFA100ABCD';
const K_PHONE = fromHex('b16d81c53a827d203b069dc197f382b07fadfb4b93ca0123051a3201da825185');

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

describe('KeystoreService (Browser)', () => {
  let keystore: BrowserKeystoreService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    keystore = TestBed.inject(BrowserKeystoreService);
  });

  it('rechnet das Token pro Gerät aus K_phone', async () => {
    keystore.useKey(K_PHONE);

    expect(toHex(await keystore.unlockToken(DEVICE_ID))).toBe(
      '40ed8815502a8e2c1bf211f072b6b881857e1735f77107f9dc828ef9d451ebe0',
    );
  });

  it('liefert für ein anderes Gerät ein anderes Token', async () => {
    keystore.useKey(K_PHONE);

    const first = await keystore.unlockToken(DEVICE_ID);
    const second = await keystore.unlockToken('7CDFA100ABCE');

    expect(toHex(first)).not.toBe(toHex(second));
  });

  it('behält ohne useKey einen zufälligen Schlüssel für die ganze Sitzung', async () => {
    const first = await keystore.unlockToken(DEVICE_ID);
    const second = await keystore.unlockToken(DEVICE_ID);

    expect(toHex(first)).toBe(toHex(second));
    expect(first).toHaveLength(32);
  });

  it('erzeugt mit den Einmal-Werten der Spezifikation den Wrap des Testvektors', async () => {
    keystore.useKey(K_PHONE);
    const deviceSecret = await sha256('device-eph');

    const envelope = await keystore.createUnlockEnvelope(
      {
        deviceEphPub: toBase64(x25519PublicKey(deviceSecret)),
        nonce: toBase64(Uint8Array.from({ length: 16 }, (_, i) => 0x60 + i)),
      },
      DEVICE_ID,
      { appEphPrivate: await sha256('app-eph'), iv: Uint8Array.from({ length: 12 }, (_, i) => 0x70 + i) },
    );

    expect(envelope.appEphPub).toBe('eVqh8pkoQ2JZydkefYsuR1PE3/Qy12/DzPg2jWPBaSk=');
    expect(envelope.wrappedToken).toBe(
      'cHFyc3R1dnd4eXp73iix4tUwvI3SCLdQkDcf6Ipj4SeWMvHCxsuoTYQbFZG8FDO6Y7fb7GfNujVODYXb',
    );
    expect(fromBase64(envelope.wrappedToken)).toHaveLength(60);
  });

  it('nimmt bei jedem Versuch neue Einmal-Schlüssel und einen neuen IV', async () => {
    const deviceSecret = await sha256('device-eph');
    const session = {
      deviceEphPub: toBase64(x25519PublicKey(deviceSecret)),
      nonce: toBase64(new Uint8Array(16)),
    };

    const first = await keystore.createUnlockEnvelope(session, DEVICE_ID);
    const second = await keystore.createUnlockEnvelope(session, DEVICE_ID);

    expect(first.appEphPub).not.toBe(second.appEphPub);
    expect(first.wrappedToken).not.toBe(second.wrappedToken);
    expect(fromBase64(first.wrappedToken)).toHaveLength(60);
  });

  it('lässt das Gerät das Token auspacken', async () => {
    keystore.useKey(K_PHONE);
    const deviceSecret = await sha256('device-eph');
    const nonce = Uint8Array.from({ length: 16 }, (_, i) => i + 1);

    const envelope = await keystore.createUnlockEnvelope(
      { deviceEphPub: toBase64(x25519PublicKey(deviceSecret)), nonce: toBase64(nonce) },
      DEVICE_ID,
    );
    const token = await unwrapToken({
      deviceEphPrivate: deviceSecret,
      appEphPublic: fromBase64(envelope.appEphPub),
      nonce,
      deviceId: DEVICE_ID,
      wrapped: fromBase64(envelope.wrappedToken),
    });

    expect(toHex(token)).toBe(toHex(await keystore.unlockToken(DEVICE_ID)));
  });
});
