package ch.offgrid.android.crypto

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.KeyGenerator
import javax.crypto.Mac
import javax.crypto.SecretKey

/** Produces the per-device unlock token `HMAC-SHA256(K_phone, "og-unlock-v1" || device_id)` (link spec 6.2). */
fun interface UnlockTokenSource {
    fun token(deviceId: ByteArray): ByteArray
}

private val TOKEN_LABEL = "og-unlock-v1".toByteArray(Charsets.US_ASCII)

/**
 * `K_phone` lives in the Android Keystore and is never readable by the app; the Keystore only
 * computes the HMAC (link spec appendix A).
 */
class KeystoreUnlockTokenSource(private val alias: String = "offgrid_unlock") : UnlockTokenSource {
    override fun token(deviceId: ByteArray): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(key())
        mac.update(TOKEN_LABEL)
        mac.update(deviceId)
        return mac.doFinal()
    }

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_HMAC_SHA256, "AndroidKeyStore")
        generator.init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN).build())
        return generator.generateKey()
    }
}

/** Token source with a known key, used for tests and for a token restored from a backup file. */
class FixedKeyUnlockTokenSource(private val kPhone: ByteArray) : UnlockTokenSource {
    override fun token(deviceId: ByteArray): ByteArray = OgCrypto.hmacSha256(kPhone, TOKEN_LABEL, deviceId)
}

/** The wrapped token envelope sent with `sec.provision`, `sec.unlock`, `sec.rotate_token` and `sys.factory_reset`. */
data class WrappedToken(val appEphPub: ByteArray, val wrapped: ByteArray)

/**
 * What a wrapped token authorizes. The HKDF label differs, so an envelope made for one purpose never
 * verifies for the other (link spec 6.11: "a normal unlock envelope cannot authorize reset").
 */
enum class WrapPurpose(label: String) {
    /** `sec.provision`, `sec.unlock`, `sec.rotate_token`. */
    UNLOCK("og-unlock-wrap-v1"),

    /** `sys.factory_reset` with `method: "app"`. */
    RESET("og-reset-wrap-v1"),
    ;

    val label: ByteArray = label.toByteArray(Charsets.US_ASCII)
}

/**
 * Link spec 6.5 and 6.11, byte for byte as `Security::unwrap` on the firmware reads it:
 * ```
 * shared   = X25519(app_eph_private, device_eph_public)
 * wrap_key = HKDF-SHA256(ikm = shared, salt = nonce (16 B), info = label || device_id_bytes (6 B), L = 32)
 * wrapped  = iv (12 B) || AES-256-GCM(wrap_key, iv, token (32 B), aad = device_id_bytes)   = 60 bytes
 * ```
 * `label` is `og-unlock-wrap-v1` or `og-reset-wrap-v1` ([WrapPurpose]).
 */
object TokenWrap {
    const val WRAPPED_SIZE = 60

    fun wrap(
        token: ByteArray,
        deviceId: ByteArray,
        deviceEphPub: ByteArray,
        nonce: ByteArray,
        purpose: WrapPurpose = WrapPurpose.UNLOCK,
        appEphPrivate: ByteArray = OgCrypto.x25519PrivateKey(),
        iv: ByteArray = OgCrypto.randomBytes(12),
    ): WrappedToken {
        require(token.size == 32) { "unlock token must be 32 bytes" }
        require(deviceId.size == 6) { "device_id must be 6 bytes" }
        require(nonce.size == 16) { "session nonce must be 16 bytes" }
        val shared = OgCrypto.x25519Shared(appEphPrivate, deviceEphPub)
        val key = wrapKey(shared, nonce, deviceId, purpose)
        val sealed = OgCrypto.aesGcmEncrypt(key, iv, token, aad = deviceId)
        return WrappedToken(OgCrypto.x25519PublicKey(appEphPrivate), iv + sealed)
    }

    /** Device side, used by the simulator. Throws when the envelope does not verify for [purpose]. */
    fun unwrap(
        wrapped: ByteArray,
        deviceId: ByteArray,
        deviceEphPrivate: ByteArray,
        appEphPub: ByteArray,
        nonce: ByteArray,
        purpose: WrapPurpose = WrapPurpose.UNLOCK,
    ): ByteArray {
        require(wrapped.size == WRAPPED_SIZE) { "wrapped token must be $WRAPPED_SIZE bytes" }
        val shared = OgCrypto.x25519Shared(deviceEphPrivate, appEphPub)
        val key = wrapKey(shared, nonce, deviceId, purpose)
        return OgCrypto.aesGcmDecrypt(key, wrapped.copyOfRange(0, 12), wrapped.copyOfRange(12, wrapped.size), aad = deviceId)
    }

    private fun wrapKey(shared: ByteArray, nonce: ByteArray, deviceId: ByteArray, purpose: WrapPurpose): ByteArray =
        OgCrypto.hkdfSha256(shared, nonce, purpose.label + deviceId, 32)
}
