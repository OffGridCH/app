package ch.offgrid.android.domain

import ch.offgrid.android.crypto.OgCrypto
import ch.offgrid.android.link.codec.OgzCodec

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

    /** `sys.hello.text_codec` values of the lab radio image. */
    const val CODEC_RAW = "raw"
    const val CODEC_OGZ1 = "ogz1"

    /**
     * Bytes [text] takes in the TEXT body on air, to compare with `AntennaState.maxTextBytes`. With `ogz1` the
     * lab image 0.3.0-lab.3 sends texts that fit raw unchanged, so a board on the team firmware (which rejects
     * compressed bodies) can still read them, and compresses only longer ones (protocol 8.1, inner flag bit 2);
     * then the same 83 bytes hold about twice the text. Above [maxInputBytes] the antenna refuses the text, and
     * the raw size is returned so the count shows it as too long.
     */
    fun onAirTextBytes(text: String, codec: String, maxInputBytes: Int): Int {
        val raw = text.toByteArray(Charsets.UTF_8)
        if (codec != CODEC_OGZ1 || raw.size <= DEFAULT_MAX_TEXT_BYTES || raw.size > maxInputBytes) return raw.size
        return OgzCodec.compress(raw, capacity = DEFAULT_MAX_TEXT_BYTES)?.size ?: raw.size
    }

    /** [canSend] for the connected antenna, including its TEXT codec. */
    fun canSend(text: String, antenna: AntennaState): Boolean =
        text.isNotBlank() && onAirTextBytes(text, antenna.textCodec, antenna.maxTextInputBytes) <= antenna.maxTextBytes

    /** Most radio messages one text is split into; longer drafts cannot be sent. */
    const val MAX_PARTS = 4

    /**
     * The radio messages the app sends for [text]: the text itself when it fits one packet of [antenna] (with
     * OGZ1 on a lab image possibly compressed), else raw pieces of at most `maxTextBytes`. The firmware does not
     * fragment (link spec 10: longer texts are split by the app). Raw pieces stay readable for boards on the
     * team firmware, which drop OGZ1 bodies without an ACK.
     */
    fun split(text: String, antenna: AntennaState): List<String> {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return emptyList()
        if (canSend(trimmed, antenna)) return listOf(trimmed)
        return splitRaw(trimmed, antenna.maxTextBytes)
    }

    /** Pieces of at most [maxBytes] UTF-8 bytes, cut after a space or line break when one is in the second half. */
    fun splitRaw(text: String, maxBytes: Int): List<String> {
        val parts = mutableListOf<String>()
        var rest = text.trim()
        while (rest.isNotEmpty()) {
            var piece = clampToBytes(rest, maxBytes)
            if (piece.length < rest.length) {
                val cut = piece.indexOfLast { it.isWhitespace() }
                if (cut >= piece.length / 2) piece = piece.substring(0, cut)
            }
            parts += piece.trim()
            rest = rest.substring(piece.length).trimStart()
        }
        return parts
    }

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
