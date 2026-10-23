package ch.offgrid.android.domain

import ch.offgrid.android.crypto.OgCrypto

/**
 * Size limits from the link and protocol specs. The radio limit is in **bytes** of UTF-8, not
 * characters: an umlaut costs 2 bytes and most emoji 4.
 */
object MessageLimits {
    /** Default `limits.max_text_bytes` (link spec 12). The device reports the real value in `sys.hello`. */
    const val DEFAULT_MAX_TEXT_BYTES = 83

    /** Names for `sec.provision`, `id.set_name` and `contact.rename` (link spec 12). */
    const val MAX_NAME_BYTES = 24

    const val MAX_GROUP_MEMBERS = 8

    fun utf8Bytes(text: String): Int = text.toByteArray(Charsets.UTF_8).size

    /** True when the trimmed text is non-empty and fits into one radio packet. */
    fun canSend(text: String, maxBytes: Int): Boolean = text.isNotBlank() && utf8Bytes(text) <= maxBytes

    fun isValidName(name: String): Boolean {
        val trimmed = name.trim()
        return trimmed.isNotEmpty() && utf8Bytes(trimmed) <= MAX_NAME_BYTES
    }

    /** Cuts a string to at most [maxBytes] UTF-8 bytes without splitting a code point. */
    fun clampToBytes(text: String, maxBytes: Int): String {
        if (utf8Bytes(text) <= maxBytes) return text
        val sb = StringBuilder()
        var used = 0
        var i = 0
        while (i < text.length) {
            val cp = text.codePointAt(i)
            val chunk = String(Character.toChars(cp))
            val size = utf8Bytes(chunk)
            if (used + size > maxBytes) break
            sb.append(chunk)
            used += size
            i += Character.charCount(cp)
        }
        return sb.toString()
    }
}

/**
 * 5x5 mirror-symmetric "Schlüssel-Muster" used as avatar. Both phones derive it from the pairing
 * fingerprint, so two people can compare the pictures instead of reading digits.
 * Algorithm from the team's design spec (KeyPatternService): column 3 mirrors 1, column 4 mirrors 0.
 */
object KeyPattern {
    fun fromSeed(seed: String): BooleanArray = fromBytes(OgCrypto.sha256(seed.toByteArray(Charsets.UTF_8)))

    fun fromBytes(bytes: ByteArray): BooleanArray {
        val cells = BooleanArray(25)
        for (y in 0 until 5) {
            for (x in 0 until 3) {
                val on = (bytes[y * 3 + x].toInt() and 1) == 1
                cells[y * 5 + x] = on
                cells[y * 5 + (4 - x)] = on
            }
        }
        if (cells.count { it } < 5) {
            cells[12] = true
            cells[11] = true
            cells[13] = true
        }
        return cells
    }

    /** Seed for a contact: the 12 fingerprint digits are identical on both phones (link spec 7.4). */
    fun contactSeed(fingerprint: String): String = "og-pattern:" + fingerprint.filter(Char::isDigit)
}
