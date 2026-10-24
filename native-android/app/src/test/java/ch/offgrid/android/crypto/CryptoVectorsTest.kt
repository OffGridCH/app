package ch.offgrid.android.crypto

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test

/** Test vectors from the link spec §11.1 and the protocol spec's worked example. */
class CryptoVectorsTest {
    private val deviceId = OgCrypto.unhex("7CDFA100ABCD")
    private val kPhone = OgCrypto.unhex("b16d81c53a827d203b069dc197f382b07fadfb4b93ca0123051a3201da825185")

    @Test
    fun unlockTokenMatchesTheSpec() {
        val token = FixedKeyUnlockTokenSource(kPhone).token(deviceId)
        assertEquals("40ed8815502a8e2c1bf211f072b6b881857e1735f77107f9dc828ef9d451ebe0", OgCrypto.hex(token).lowercase())
        assertArrayEquals(OgCrypto.sha256("android-keystore-demo-key".toByteArray()), kPhone)
    }

    @Test
    fun tokenWrapMatchesTheSpecAndUnwraps() {
        val token = FixedKeyUnlockTokenSource(kPhone).token(deviceId)
        val devicePriv = OgCrypto.sha256("device-eph".toByteArray())
        val appPriv = OgCrypto.sha256("app-eph".toByteArray())
        val nonce = ByteArray(16) { (0x60 + it).toByte() }
        val iv = ByteArray(12) { (0x70 + it).toByte() }
        val devicePub = OgCrypto.x25519PublicKey(devicePriv)
        assertEquals("3F3+lep6lCFDIkWOsKWMD23g3Q35wH80fqT/H8cS0n4=", OgCrypto.b64(devicePub))

        val wrapped = TokenWrap.wrap(token, deviceId, devicePub, nonce, appEphPrivate = appPriv, iv = iv)
        assertEquals("eVqh8pkoQ2JZydkefYsuR1PE3/Qy12/DzPg2jWPBaSk=", OgCrypto.b64(wrapped.appEphPub))
        assertEquals("cHFyc3R1dnd4eXp73iix4tUwvI3SCLdQkDcf6Ipj4SeWMvHCxsuoTYQbFZG8FDO6Y7fb7GfNujVODYXb", OgCrypto.b64(wrapped.wrapped))
        assertEquals(TokenWrap.WRAPPED_SIZE, wrapped.wrapped.size)

        assertArrayEquals(token, TokenWrap.unwrap(wrapped.wrapped, deviceId, devicePriv, wrapped.appEphPub, nonce))
    }

    @Test
    fun fingerprintAndNodeIdMatchTheWorkedExample() {
        val alice = OgCrypto.unb64("Losog8J7ORNZ19DBXQCBWmaTKQo43Y66NBzAfdqo7U0=")
        val bob = OgCrypto.unb64("wLEmtaoTS4TmRiUla43olzeHYSsfODnSxgUm0hFOiG0=")
        assertEquals("0501 3010 7790", OgCrypto.fingerprint(alice, bob))
        assertEquals("0501 3010 7790", OgCrypto.fingerprint(bob, alice))
        assertEquals("E3F0", OgCrypto.nodeId(alice))
        assertEquals("E841", OgCrypto.nodeId(bob))
    }
}
