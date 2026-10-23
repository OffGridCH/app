import { fromHex, toHex } from '../crypto/hex';
import { x25519, x25519PublicKey } from './x25519';

describe('x25519 (RFC 7748)', () => {
  it('rechnet den ersten Vektor aus §5.2', () => {
    const scalar = fromHex('a546e36bf0527c9d3b16154b82465edd62144c0ac1fc5a18506a2244ba449ac4');
    const point = fromHex('e6db6867583030db3594c1a424b15f7c726624ec26b3353b10a903a6d0ab1c4c');

    expect(toHex(x25519(scalar, point))).toBe('c3da55379de9c6908e94ea4df28d084f32eccf03491c71f754b4075577a28552');
  });

  it('rechnet den zweiten Vektor aus §5.2 (Bit 255 des Punktes wird ignoriert)', () => {
    const scalar = fromHex('4b66e9d4d1b4673c5ad22691957d6af5c11b6421e0ea01d42ca4169e7918ba0d');
    const point = fromHex('e5210f12786811d3f4b7959d0538ae2c31dbe7106fc03c3efc4cd549c715a493');

    expect(toHex(x25519(scalar, point))).toBe('95cbde9476e8907d7aade45cb4b873f88b595a68799fa152e6f8f7647aac7957');
  });

  it('rechnet den Schlüsselaustausch aus §6.1', () => {
    const alicePrivate = fromHex('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a');
    const bobPrivate = fromHex('5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb');

    const alicePublic = x25519PublicKey(alicePrivate);
    const bobPublic = x25519PublicKey(bobPrivate);

    expect(toHex(alicePublic)).toBe('8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a');
    expect(toHex(bobPublic)).toBe('de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f');
    expect(toHex(x25519(alicePrivate, bobPublic))).toBe(
      '4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742',
    );
    expect(toHex(x25519(bobPrivate, alicePublic))).toBe(
      '4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742',
    );
  });

  it('weist Schlüssel falscher Länge ab', () => {
    expect(() => x25519(new Uint8Array(31), new Uint8Array(32))).toThrow('x25519-invalid-length');
    expect(() => x25519(new Uint8Array(32), new Uint8Array(33))).toThrow('x25519-invalid-length');
  });

  it('weist einen Punkt kleiner Ordnung ab', () => {
    const scalar = fromHex('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a');

    expect(() => x25519(scalar, new Uint8Array(32))).toThrow('x25519-low-order-point');
  });
});
