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
    fun namesAreOneTo24Bytes() {
        assertTrue(MessageLimits.isValidName("Anna Meier"))
        assertTrue(MessageLimits.isValidName("a".repeat(24)))
        assertFalse(MessageLimits.isValidName("a".repeat(25)))
        assertFalse(MessageLimits.isValidName("ü".repeat(13)))
        assertFalse(MessageLimits.isValidName("  "))
    }
}
