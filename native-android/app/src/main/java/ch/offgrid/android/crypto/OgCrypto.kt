package ch.offgrid.android.crypto

import org.bouncycastle.math.ec.rfc7748.X25519
import java.math.BigInteger
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/** Small crypto toolbox shared by the app side (unlock wrap, backup) and the firmware simulator. */
object OgCrypto {
    private val random = SecureRandom()

    fun randomBytes(n: Int): ByteArray = ByteArray(n).also(random::nextBytes)

    fun sha256(vararg parts: ByteArray): ByteArray =
        MessageDigest.getInstance("SHA-256").run { parts.forEach(::update); digest() }

    fun hmacSha256(key: ByteArray, vararg parts: ByteArray): ByteArray =
        Mac.getInstance("HmacSHA256").run {
            init(SecretKeySpec(key, "HmacSHA256"))
            parts.forEach(::update)
            doFinal()
        }

    /** RFC 5869 HKDF with SHA-256. An empty salt means a zero-filled salt of hash length. */
    fun hkdfSha256(ikm: ByteArray, salt: ByteArray, info: ByteArray, length: Int): ByteArray {
        val prk = hmacSha256(if (salt.isEmpty()) ByteArray(32) else salt, ikm)
        val out = ByteArray(length)
        var previous = ByteArray(0)
        var produced = 0
        var counter = 1
        while (produced < length) {
            previous = hmacSha256(prk, previous, info, byteArrayOf(counter.toByte()))
            val n = minOf(previous.size, length - produced)
            System.arraycopy(previous, 0, out, produced, n)
            produced += n
            counter++
        }
        return out
    }

    // ---- X25519 (Bouncy Castle low-level API, works on every API level from 26) ----

    fun x25519PrivateKey(): ByteArray = ByteArray(X25519.SCALAR_SIZE).also { X25519.generatePrivateKey(random, it) }

    fun x25519PublicKey(privateKey: ByteArray): ByteArray =
        ByteArray(X25519.POINT_SIZE).also { X25519.generatePublicKey(privateKey, 0, it, 0) }

    fun x25519Shared(privateKey: ByteArray, peerPublic: ByteArray): ByteArray {
        val out = ByteArray(X25519.POINT_SIZE)
        check(X25519.calculateAgreement(privateKey, 0, peerPublic, 0, out, 0)) { "X25519 produced an all-zero secret" }
        return out
    }

    // ---- AES-GCM (128-bit tag) ----

    fun aesGcmEncrypt(key: ByteArray, iv: ByteArray, plain: ByteArray, aad: ByteArray? = null): ByteArray =
        Cipher.getInstance("AES/GCM/NoPadding").run {
            init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(128, iv))
            if (aad != null) updateAAD(aad)
            doFinal(plain)
        }

    /** Throws [javax.crypto.AEADBadTagException] when the key, IV, AAD or data do not match. */
    fun aesGcmDecrypt(key: ByteArray, iv: ByteArray, cipherAndTag: ByteArray, aad: ByteArray? = null): ByteArray =
        Cipher.getInstance("AES/GCM/NoPadding").run {
            init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(128, iv))
            if (aad != null) updateAAD(aad)
            doFinal(cipherAndTag)
        }

    // ---- Encodings (link spec 4.5: standard Base64 with padding, uppercase hex IDs) ----

    fun b64(bytes: ByteArray): String = Base64.getEncoder().encodeToString(bytes)
    fun unb64(text: String): ByteArray = Base64.getDecoder().decode(text)
    fun hex(bytes: ByteArray): String = bytes.joinToString("") { "%02X".format(it) }
    fun unhex(text: String): ByteArray {
        require(text.length % 2 == 0) { "odd hex length" }
        return ByteArray(text.length / 2) { text.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
    }

    /** Protocol spec 5.1: NodeID = SHA256(public_key)[0:2], shown as 4 uppercase hex characters. */
    fun nodeId(publicKey: ByteArray): String = hex(sha256(publicKey).copyOfRange(0, 2))

    /**
     * Link spec 7.4: `SHA256("og1-fp" || pub_low || pub_high)` with the keys sorted bytewise, first
     * 8 bytes as big-endian number, modulo 10^12, shown as three groups of four digits.
     */
    fun fingerprint(publicA: ByteArray, publicB: ByteArray): String {
        val (low, high) = if (compareUnsigned(publicA, publicB) <= 0) publicA to publicB else publicB to publicA
        val digest = sha256("og1-fp".toByteArray(Charsets.US_ASCII), low, high)
        val value = BigInteger(1, digest.copyOfRange(0, 8)).mod(BigInteger.TEN.pow(12))
        val digits = value.toString().padStart(12, '0')
        return "${digits.substring(0, 4)} ${digits.substring(4, 8)} ${digits.substring(8, 12)}"
    }

    fun compareUnsigned(a: ByteArray, b: ByteArray): Int {
        for (i in 0 until minOf(a.size, b.size)) {
            val d = (a[i].toInt() and 0xFF) - (b[i].toInt() and 0xFF)
            if (d != 0) return d
        }
        return a.size - b.size
    }
}
