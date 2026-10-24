package ch.offgrid.android.crypto

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

/**
 * The app's token wrap against vectors computed independently from the firmware's `Security::unwrap`
 * (OffGridCH/firmware `feature/mesh-direct`, `src/security/Security.cpp`) with Python `cryptography`.
 * Regenerate with `python tools/wrap_vectors.py`; the inputs below are the script's fixed inputs.
 */
class TokenWrapFirmwareVectorTest {
    // byte i of the 12-hex device_id string is byte i of the device_id the firmware binds into HKDF and AAD
    private val deviceId = OgCrypto.unhex("A4CF12F00D42")
    private val kPhone = OgCrypto.sha256("offgrid-lab3-test-phone".toByteArray())
    private val devicePriv = OgCrypto.sha256("lab3-device-eph".toByteArray())
    private val appPriv = OgCrypto.sha256("lab3-app-eph".toByteArray())
    private val nonce = ByteArray(16) { (0xA0 + it).toByte() }
    private val iv = ByteArray(12) { (0xC0 + it).toByte() }
    private val token = FixedKeyUnlockTokenSource(kPhone).token(deviceId)
    private val devicePub = OgCrypto.x25519PublicKey(devicePriv)

    @Test
    fun tokenAndKeysMatchThePythonVectors() {
        assertEquals("94b40ca8489d5c45e898aa06ea1c1be498e76a413b071d642944f452971a2fba", OgCrypto.hex(kPhone).lowercase())
        assertEquals("9d13223c326261038551a88b95344e773776b4933cdff1d65c5a09160ed3861d", OgCrypto.hex(token).lowercase())
        assertEquals("GwmZHT/GaxR8zgYEQpZbj8cLL6pe/VwVM+nsod1y+D8=", OgCrypto.b64(devicePub))
        assertEquals("oKGio6SlpqeoqaqrrK2urw==", OgCrypto.b64(nonce))
    }

    @Test
    fun unlockEnvelopeMatchesTheFirmwareLayout() {
        val w = TokenWrap.wrap(token, deviceId, devicePub, nonce, WrapPurpose.UNLOCK, appEphPrivate = appPriv, iv = iv)
        assertEquals("++O/5uAfCkpZuRYN3vtPMk0AhUKWY52l6HQOz/nkMGw=", OgCrypto.b64(w.appEphPub))
        assertEquals("wMHCw8TFxsfIycrLFVGt58hU/tktNkM7r316VJHwE3EHbF7nXE8G6qMlr6ed7nWJACkngOAbP7bruJl7", OgCrypto.b64(w.wrapped))
        assertEquals(60, w.wrapped.size)
        assertArrayEquals("iv leads the envelope", iv, w.wrapped.copyOfRange(0, 12))
        assertArrayEquals(token, TokenWrap.unwrap(w.wrapped, deviceId, devicePriv, w.appEphPub, nonce, WrapPurpose.UNLOCK))
    }

    @Test
    fun resetEnvelopeUsesItsOwnLabel() {
        val w = TokenWrap.wrap(token, deviceId, devicePub, nonce, WrapPurpose.RESET, appEphPrivate = appPriv, iv = iv)
        assertEquals("wMHCw8TFxsfIycrL+9LSWnqL0CAeOvJeke4W5qztIr+2+yn3oVLnCvwyohkK58V/Ke7YA0aHRGS4TJUd", OgCrypto.b64(w.wrapped))
        assertArrayEquals(token, TokenWrap.unwrap(w.wrapped, deviceId, devicePriv, w.appEphPub, nonce, WrapPurpose.RESET))
    }

    @Test
    fun anUnlockEnvelopeCannotAuthorizeAReset() {
        val unlock = TokenWrap.wrap(token, deviceId, devicePub, nonce, WrapPurpose.UNLOCK, appEphPrivate = appPriv, iv = iv)
        assertThrows(Exception::class.java) {
            TokenWrap.unwrap(unlock.wrapped, deviceId, devicePriv, unlock.appEphPub, nonce, WrapPurpose.RESET)
        }
        val reset = TokenWrap.wrap(token, deviceId, devicePub, nonce, WrapPurpose.RESET, appEphPrivate = appPriv, iv = iv)
        assertThrows(Exception::class.java) {
            TokenWrap.unwrap(reset.wrapped, deviceId, devicePriv, reset.appEphPub, nonce, WrapPurpose.UNLOCK)
        }
    }

    @Test
    fun theEnvelopeIsBoundToTheDeviceId() {
        val w = TokenWrap.wrap(token, deviceId, devicePub, nonce, appEphPrivate = appPriv, iv = iv)
        val otherDevice = OgCrypto.unhex("420DF012CFA4")
        assertThrows(Exception::class.java) {
            TokenWrap.unwrap(w.wrapped, otherDevice, devicePriv, w.appEphPub, nonce)
        }
    }
}
