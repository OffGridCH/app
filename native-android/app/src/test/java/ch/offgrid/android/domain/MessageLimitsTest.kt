package ch.offgrid.android.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MessageLimitsTest {
    private val max = MessageLimits.DEFAULT_MAX_TEXT_BYTES

    @Test
    fun textLimitIs83Utf8Bytes() {
        assertEquals(83, max)
        assertTrue(MessageLimits.canSend("a".repeat(83), max))
        assertFalse(MessageLimits.canSend("a".repeat(84), max))
        assertFalse(MessageLimits.canSend("   ", max))
    }

    @Test
    fun umlautsAndEmojiCountTheirUtf8Bytes() {
        assertEquals(2, MessageLimits.utf8Bytes("ü"))
        assertEquals(4, MessageLimits.utf8Bytes("👍"))
        assertEquals(6, MessageLimits.utf8Bytes("❤️")) // heart plus variation selector
        // 41 umlauts = 82 bytes fit, 42 = 84 bytes do not.
        assertTrue(MessageLimits.canSend("ä".repeat(41), max))
        assertFalse(MessageLimits.canSend("ä".repeat(42), max))
    }

    @Test
    fun clampNeverSplitsACodePoint() {
        assertEquals("aa", MessageLimits.clampToBytes("aa👍", 5))
        assertEquals("aa👍", MessageLimits.clampToBytes("aa👍", 6))
        assertEquals("Zürich", MessageLimits.clampToBytes("Zürich", 7))
    }

    @Test
    fun ogz1CountMatchesWhatTheLabAntennaSent() {
        // 127 bytes raw; the lab image sent it as a 64-byte packet: 8 header + 1 inner + 47 + 8 tag (2026-10-24).
        val text = "Wir sind bei der Hütte oben, das Wetter wird schlechter. Kommt bitte nicht mehr hoch, " +
            "wir treffen uns um 16:30 beim Parkplatz."
        assertEquals(127, MessageLimits.onAirTextBytes(text, MessageLimits.CODEC_RAW, 83))
        assertEquals(47, MessageLimits.onAirTextBytes(text, MessageLimits.CODEC_OGZ1, 160))
        val lab = AntennaState(textCodec = MessageLimits.CODEC_OGZ1, maxTextInputBytes = 160)
        assertTrue(MessageLimits.canSend(text, lab))
        assertFalse(MessageLimits.canSend(text, AntennaState()))
    }

    @Test
    fun ogz1NeverCountsMoreThanRawAndRespectsTheInputLimit() {
        assertEquals(2, MessageLimits.onAirTextBytes("ok", MessageLimits.CODEC_OGZ1, 160))
        assertEquals(0, MessageLimits.onAirTextBytes("", MessageLimits.CODEC_OGZ1, 160))
        // Random hex does not compress below 83 bytes, and 161 bytes are over the antenna's input limit.
        val hex = "0123456789abcdef".repeat(10)
        assertFalse(MessageLimits.canSend(hex, AntennaState(textCodec = MessageLimits.CODEC_OGZ1, maxTextInputBytes = 160)))
        assertEquals(161, MessageLimits.onAirTextBytes(hex + "a", MessageLimits.CODEC_OGZ1, 160))
    }

    @Test
    fun ogz1LeavesTextsThatFitRawUncompressed() {
        // Lab.3 compresses only texts over 83 bytes, so a team board can read everything up to that (OGZ1 would be 14).
        val text = "Bin gleich da, wartet beim Eingang auf mich."
        assertEquals(44, MessageLimits.onAirTextBytes(text, MessageLimits.CODEC_OGZ1, 160))
    }

    @Test
    fun namesAreOneTo24Bytes() {
        assertTrue(MessageLimits.isValidName("Anna Meier"))
        assertTrue(MessageLimits.isValidName("a".repeat(24)))
        assertFalse(MessageLimits.isValidName("a".repeat(25)))
        assertFalse(MessageLimits.isValidName("ü".repeat(13)))
        assertFalse(MessageLimits.isValidName("  "))
    }

    @Test
    fun longTextsAreSplitIntoRawPiecesAtSpaces() {
        val text = "Wir sind bei der Hütte oben, das Wetter wird schlechter. Kommt bitte nicht mehr hoch, " +
            "wir treffen uns um 16:30 beim Parkplatz."
        val parts = MessageLimits.split(text, AntennaState())
        assertEquals(2, parts.size)
        assertTrue(parts.all { MessageLimits.utf8Bytes(it) <= 83 })
        assertTrue(parts[0].endsWith("nicht mehr"))
        assertEquals(text, parts.joinToString(" "))
        // A lab image with OGZ1 fits it into one packet, so it is not split.
        assertEquals(listOf(text), MessageLimits.split(text, AntennaState(textCodec = MessageLimits.CODEC_OGZ1, maxTextInputBytes = 160)))
        assertEquals(listOf("Hallo"), MessageLimits.split("  Hallo ", AntennaState()))
        assertTrue(MessageLimits.split("   ", AntennaState()).isEmpty())
    }

    @Test
    fun aWordLongerThanAPacketIsCutWithoutBreakingCodePoints() {
        val parts = MessageLimits.splitRaw("ü".repeat(50) + "😀".repeat(30), 83)
        assertTrue(parts.all { MessageLimits.utf8Bytes(it) <= 83 })
        assertEquals("ü".repeat(50) + "😀".repeat(30), parts.joinToString(""))
        assertEquals(3, parts.size)
    }
}
