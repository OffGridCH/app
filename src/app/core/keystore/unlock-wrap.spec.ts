import { fromBase64, toBase64 } from '../crypto/base64';
import { fromHex, toHex } from '../crypto/hex';
import { hmacSha256, unlockTokenInput, unwrapToken, wrapToken } from './unlock-wrap';
import { x25519PublicKey } from './x25519';

/** Testvektor aus Offgrid Host Interface v1, §11.1 und Appendix B. */
const DEVICE_ID = '7CDFA100ABCD';
const K_PHONE = fromHex('b16d81c53a827d203b069dc197f382b07fadfb4b93ca0123051a3201da825185');
const TOKEN = '40ed8815502a8e2c1bf211f072b6b881857e1735f77107f9dc828ef9d451ebe0';
const DEVICE_EPH_PUB = '3F3+lep6lCFDIkWOsKWMD23g3Q35wH80fqT/H8cS0n4=';
const APP_EPH_PUB = 'eVqh8pkoQ2JZydkefYsuR1PE3/Qy12/DzPg2jWPBaSk=';
const NONCE = bytesFrom(0x60, 16);
const IV = bytesFrom(0x70, 12);
const WRAPPED =
  'cHFyc3R1dnd4eXp73iix4tUwvI3SCLdQkDcf6Ipj4SeWMvHCxsuoTYQbFZG8FDO6Y7fb7GfNujVODYXb';

function bytesFrom(start: number, length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, i) => start + i);
}

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

describe('Entsperr-Token und Wrap (Testvektor der Spezifikation)', () => {
  it('rechnet das Token als HMAC-SHA256(K_phone, "og-unlock-v1" || device_id_bytes)', async () => {
    const token = await hmacSha256(K_PHONE, unlockTokenInput(DEVICE_ID));

    expect(toHex(token)).toBe(TOKEN);
  });

  it('hängt die device_id als 6 Rohbytes an', () => {
    const input = unlockTokenInput(DEVICE_ID);

    expect(new TextDecoder().decode(input.slice(0, 12))).toBe('og-unlock-v1');
    expect(toHex(input.slice(12))).toBe('7cdfa100abcd');
  });

  it('lehnt eine ungültige device_id ab', () => {
    expect(() => unlockTokenInput('7CDFA100AB')).toThrow('invalid-device-id');
    expect(() => unlockTokenInput('7CDFA100ABZZ')).toThrow('invalid-device-id');
  });

  it('erzeugt aus den festen Einmal-Schlüsseln genau die Schlüssel der Spezifikation', async () => {
    const deviceSecret = await sha256('device-eph');
    const appSecret = await sha256('app-eph');

    expect(toBase64(x25519PublicKey(deviceSecret))).toBe(DEVICE_EPH_PUB);
    expect(toBase64(x25519PublicKey(appSecret))).toBe(APP_EPH_PUB);
  });

  it('packt das Token zu 60 Bytes und stimmt mit dem Testvektor überein', async () => {
    const appSecret = await sha256('app-eph');

    const wrapped = await wrapToken({
      appEphPrivate: appSecret,
      deviceEphPublic: fromBase64(DEVICE_EPH_PUB),
      nonce: NONCE,
      deviceId: DEVICE_ID,
      token: fromHex(TOKEN),
      iv: IV,
    });

    expect(wrapped).toHaveLength(60);
    expect(toBase64(wrapped)).toBe(WRAPPED);
  });

  it('besteht aus IV, 32 Byte Chiffretext und 16 Byte Tag', async () => {
    const wrapped = fromBase64(WRAPPED);

    expect(toHex(wrapped.slice(0, 12))).toBe(toHex(IV));
    expect(wrapped.slice(12, 44)).toHaveLength(32);
    expect(wrapped.slice(44)).toHaveLength(16);
  });

  it('wird vom Gerät mit seinem Einmal-Schlüssel wieder zum Token ausgepackt', async () => {
    const deviceSecret = await sha256('device-eph');

    const token = await unwrapToken({
      deviceEphPrivate: deviceSecret,
      appEphPublic: fromBase64(APP_EPH_PUB),
      nonce: NONCE,
      deviceId: DEVICE_ID,
      wrapped: fromBase64(WRAPPED),
    });

    expect(toHex(token)).toBe(TOKEN);
  });

  it('wird für ein anderes Gerät, eine andere Nonce oder verfälschte Bytes abgelehnt', async () => {
    const deviceSecret = await sha256('device-eph');
    const base = {
      deviceEphPrivate: deviceSecret,
      appEphPublic: fromBase64(APP_EPH_PUB),
      nonce: NONCE,
      deviceId: DEVICE_ID,
      wrapped: fromBase64(WRAPPED),
    };

    await expect(unwrapToken({ ...base, deviceId: '7CDFA100ABCE' })).rejects.toThrow();
    await expect(unwrapToken({ ...base, nonce: bytesFrom(0x61, 16) })).rejects.toThrow();
    const tampered = new Uint8Array(base.wrapped);
    tampered[20] ^= 1;
    await expect(unwrapToken({ ...base, wrapped: tampered })).rejects.toThrow();
  });

  it('lehnt Eingaben falscher Länge ab', async () => {
    const appSecret = await sha256('app-eph');

    await expect(
      wrapToken({
        appEphPrivate: appSecret,
        deviceEphPublic: fromBase64(DEVICE_EPH_PUB),
        nonce: NONCE,
        deviceId: DEVICE_ID,
        token: new Uint8Array(31),
        iv: IV,
      }),
    ).rejects.toThrow('invalid-wrap-input');
    await expect(
      unwrapToken({
        deviceEphPrivate: appSecret,
        appEphPublic: fromBase64(APP_EPH_PUB),
        nonce: NONCE,
        deviceId: DEVICE_ID,
        wrapped: new Uint8Array(59),
      }),
    ).rejects.toThrow('invalid-wrapped-length');
  });
});
