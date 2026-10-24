package ch.offgrid.android.link.codec

/**
 * OGZ1 text codec for TEXT bodies (inner flag bit 2 = compressed), bit-exact with the firmware's
 * TextCodec.cpp and the Python reference analysis/ogz1.py, which specifies the format.
 *
 * Encoder: optimal parse over byte positions. Tie-break at every position: fewest bits, then the
 * longest match, then the lowest symbol index; ESC is used only when strictly cheaper.
 * Packing: MSB first, final byte padded with 1-bits. Decoder accepts the end of input at a symbol
 * boundary or inside at most 7 padding 1-bits; everything else is an error (null).
 * Send the compressed form only when it is shorter than the raw UTF-8 bytes.
 */
object OgzCodec {
    /** Returns the encoded bytes, or null if [utf8] is empty, longer than 160 bytes, or does not fit [capacity]. */
    fun compress(utf8: ByteArray, capacity: Int = OgzTables.MAX_OUTPUT_BYTES): ByteArray? {
        val n = utf8.size
        if (n == 0 || n > OgzTables.MAX_INPUT_BYTES) return null
        val len = OgzTables.CODE_LENGTH
        val cost = IntArray(n + 1)
        val stepSymbol = IntArray(n)
        val stepLength = IntArray(n)
        val stepCap = BooleanArray(n)
        for (i in n - 1 downTo 0) {
            var best = Int.MAX_VALUE
            var bestLength = 0
            var bestSymbol = OgzTables.ESC
            var bestCap = false
            for (s in 2 until OgzTables.SYMBOL_COUNT) {
                val m = match(s, utf8, i)
                if (m == NO_MATCH) continue
                val l = symbolLength(s)
                val c = (if (m == CAP_MATCH) len[OgzTables.CAP] else 0) + len[s] + cost[i + l]
                if (c < best || (c == best && l > bestLength)) {
                    best = c
                    bestLength = l
                    bestSymbol = s
                    bestCap = m == CAP_MATCH
                }
            }
            val esc = len[OgzTables.ESC] + 8 + cost[i + 1]
            if (esc < best) {
                best = esc
                bestLength = 1
                bestSymbol = OgzTables.ESC
                bestCap = false
            }
            cost[i] = best
            stepSymbol[i] = bestSymbol
            stepLength[i] = bestLength
            stepCap[i] = bestCap
        }
        val bytes = (cost[0] + 7) / 8
        if (bytes > capacity) return null
        val out = ByteArray(bytes)
        var bit = 0
        fun put(value: Int, count: Int) {
            for (k in count - 1 downTo 0) {
                if ((value ushr k) and 1 == 1) {
                    out[bit ushr 3] = (out[bit ushr 3].toInt() or (0x80 ushr (bit and 7))).toByte()
                }
                bit++
            }
        }
        var i = 0
        while (i < n) {
            val s = stepSymbol[i]
            if (stepCap[i]) put(OgzTables.CODE[OgzTables.CAP], len[OgzTables.CAP])
            put(OgzTables.CODE[s], len[s])
            if (s == OgzTables.ESC) put(utf8[i].toInt() and 0xFF, 8)
            i += stepLength[i]
        }
        while (bit and 7 != 0) put(1, 1) // padding never decodes: the all-ones code is >= 8 bits
        return out
    }

    /** Returns the decoded UTF-8 bytes, or null on any format error or output over 160 bytes. */
    fun expand(encoded: ByteArray): ByteArray? {
        if (encoded.isEmpty()) return null
        val totalBits = encoded.size * 8
        val out = ByteArray(OgzTables.MAX_INPUT_BYTES)
        var produced = 0
        var pos = 0
        var pendingCap = false
        fun bitAt(p: Int): Int = (encoded[p ushr 3].toInt() ushr (7 - (p and 7))) and 1
        while (true) {
            var code = 0
            var first = 0
            var index = 0
            var ones = true
            var symbol = -1
            for (l in 1..OgzTables.MAX_CODE_LENGTH) {
                if (pos >= totalBits) {
                    // End of input: fine at a symbol boundary or inside <= 7 padding 1-bits.
                    return if ((l == 1 || (ones && l - 1 <= 7)) && !pendingCap) out.copyOf(produced) else null
                }
                val b = bitAt(pos++)
                ones = ones && b == 1
                code = code or b
                val count = OgzTables.LENGTH_COUNT[l]
                if (code - first < count) {
                    symbol = OgzTables.SORTED_SYMBOLS[index + code - first]
                    break
                }
                index += count
                first = (first + count) shl 1
                code = code shl 1
            }
            when {
                symbol < 0 -> return null
                symbol == OgzTables.ESC -> {
                    if (pendingCap || totalBits - pos < 8 || produced + 1 > out.size) return null
                    var v = 0
                    repeat(8) { v = (v shl 1) or bitAt(pos++) }
                    out[produced++] = v.toByte()
                }
                symbol == OgzTables.CAP -> {
                    if (pendingCap) return null
                    pendingCap = true
                }
                else -> {
                    val l = symbolLength(symbol)
                    if (produced + l > out.size) return null
                    System.arraycopy(OgzTables.SYMBOL_BYTES, OgzTables.SYMBOL_OFFSET[symbol], out, produced, l)
                    if (pendingCap) {
                        val b0 = out[produced].toInt() and 0xFF
                        if (b0 in 0x61..0x7A) {
                            out[produced] = (b0 - 0x20).toByte()
                        } else {
                            val b1 = if (l >= 2) out[produced + 1].toInt() and 0xFF else -1
                            if (b0 == 0xC3 && (b1 == 0xA4 || b1 == 0xB6 || b1 == 0xBC)) {
                                out[produced + 1] = (b1 - 0x20).toByte()
                            } else {
                                return null
                            }
                        }
                        pendingCap = false
                    }
                    produced += l
                }
            }
        }
    }

    private const val NO_MATCH = 0
    private const val PLAIN_MATCH = 1
    private const val CAP_MATCH = 2 // input starts with the upper-case form of the symbol (CAP + symbol)

    private fun symbolLength(s: Int): Int = OgzTables.SYMBOL_OFFSET[s + 1] - OgzTables.SYMBOL_OFFSET[s]

    private fun equalFrom(input: ByteArray, at: Int, start: Int, from: Int, length: Int): Boolean {
        for (k in from until length) if (input[at + k] != OgzTables.SYMBOL_BYTES[start + k]) return false
        return true
    }

    private fun match(s: Int, input: ByteArray, at: Int): Int {
        val l = symbolLength(s)
        if (l == 0 || l > input.size - at) return NO_MATCH
        val start = OgzTables.SYMBOL_OFFSET[s]
        if (equalFrom(input, at, start, 0, l)) return PLAIN_MATCH
        val a0 = input[at].toInt() and 0xFF
        val s0 = OgzTables.SYMBOL_BYTES[start].toInt() and 0xFF
        if (a0 in 0x41..0x5A) {
            return if (s0 == a0 + 0x20 && equalFrom(input, at, start, 1, l)) CAP_MATCH else NO_MATCH
        }
        if (l >= 2 && a0 == 0xC3) {
            val a1 = input[at + 1].toInt() and 0xFF
            if (a1 == 0x84 || a1 == 0x96 || a1 == 0x9C) {
                val s1 = OgzTables.SYMBOL_BYTES[start + 1].toInt() and 0xFF
                return if (s0 == 0xC3 && s1 == a1 + 0x20 && equalFrom(input, at, start, 2, l)) CAP_MATCH else NO_MATCH
            }
        }
        return NO_MATCH
    }
}
