#!/usr/bin/env python3
"""Independent test vectors for the unlock and reset token wrap (link spec 6.5 and 6.11).

Written from the firmware side, `src/security/Security.cpp` on OffGridCH/firmware
`feature/mesh-direct` (c152810), not from the app code:

    info     = label || device_id_bytes            label "og-unlock-wrap-v1" or "og-reset-wrap-v1"
    key      = HKDF-SHA256(ikm = X25519(device_eph, app_eph_pub), salt = session nonce (16 B), info, L = 32)
    wrapped  = iv (12 B) || ciphertext (32 B) || tag (16 B)
    token    = AES-256-GCM-decrypt(key, iv = wrapped[0:12], aad = device_id_bytes (6 B),
                                   ciphertext = wrapped[12:44], tag = wrapped[44:60])

`device_id_bytes` are the 6 bytes of the 12-hex `device_id` from `sys.hello` in string order
(Commands::initSecure prints byte i of the eFuse MAC as hex pair i, App::init passes byte i as
deviceId[i]). The app's JVM test `TokenWrapFirmwareVectorTest` embeds the output.

Requires `pip install cryptography`. Run: python tools/wrap_vectors.py
"""
import base64
import hashlib
import hmac

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

RAW = dict(encoding=serialization.Encoding.Raw, format=serialization.PublicFormat.Raw)

DEVICE_ID_HEX = "A4CF12F00D42"
K_PHONE = hashlib.sha256(b"offgrid-lab3-test-phone").digest()
DEVICE_EPH = X25519PrivateKey.from_private_bytes(hashlib.sha256(b"lab3-device-eph").digest())
APP_EPH = X25519PrivateKey.from_private_bytes(hashlib.sha256(b"lab3-app-eph").digest())
NONCE = bytes(range(0xA0, 0xB0))
IV = bytes(range(0xC0, 0xCC))


def device_unwrap(label, device_id, app_pub, wrapped):
    """Security::unwrap, byte for byte."""
    if len(wrapped) != 60:
        raise ValueError("wrapped token must be 60 bytes")
    shared = DEVICE_EPH.exchange(X25519PublicKey.from_public_bytes(app_pub))
    key = HKDF(hashes.SHA256(), 32, NONCE, label + device_id).derive(shared)
    iv, ciphertext, tag = wrapped[:12], wrapped[12:44], wrapped[44:60]
    return AESGCM(key).decrypt(iv, ciphertext + tag, device_id)


def app_wrap(label, device_id, token):
    shared = APP_EPH.exchange(DEVICE_EPH.public_key())
    key = HKDF(hashes.SHA256(), 32, NONCE, label + device_id).derive(shared)
    return IV + AESGCM(key).encrypt(IV, token, device_id)


def main():
    device_id = bytes.fromhex(DEVICE_ID_HEX)
    token = hmac.new(K_PHONE, b"og-unlock-v1" + device_id, hashlib.sha256).digest()
    app_pub = APP_EPH.public_key().public_bytes(**RAW)
    print("device_id       ", DEVICE_ID_HEX)
    print("k_phone         ", K_PHONE.hex())
    print("token           ", token.hex())
    print("device_eph_pub  ", base64.b64encode(DEVICE_EPH.public_key().public_bytes(**RAW)).decode())
    print("nonce           ", base64.b64encode(NONCE).decode())
    print("app_eph_pub     ", base64.b64encode(app_pub).decode())
    for name, label in (("unlock", b"og-unlock-wrap-v1"), ("reset", b"og-reset-wrap-v1")):
        wrapped = app_wrap(label, device_id, token)
        assert device_unwrap(label, device_id, app_pub, wrapped) == token
        print(f"{name:6} wrapped  ", base64.b64encode(wrapped).decode())
    # A normal unlock envelope must not authorize a reset, and the other way round (spec 6.11).
    unlock = app_wrap(b"og-unlock-wrap-v1", device_id, token)
    try:
        device_unwrap(b"og-reset-wrap-v1", device_id, app_pub, unlock)
        raise SystemExit("unlock envelope accepted as reset")
    except InvalidTag:
        print("unlock envelope rejected by the reset label: ok")


if __name__ == "__main__":
    main()
