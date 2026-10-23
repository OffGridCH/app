package ch.offgrid.android.link

import org.junit.Assert.assertEquals
import org.junit.Test

class LineFramerTest {
    private fun bytes(s: String) = s.toByteArray(Charsets.UTF_8)

    @Test
    fun dropsTheFirstPartialLineAfterConnecting() {
        val framer = LineFramer()
        val out = framer.feed(bytes("\"ok\":true}\n{\"evt\":\"sys.boot\"}\n"))
        assertEquals(listOf(FramedLine.Json("{\"evt\":\"sys.boot\"}")), out)
    }

    @Test
    fun keepsACompleteFirstLineBecauseTheUartHasNothingInFlightOnOpen() {
        val framer = LineFramer()
        val out = framer.feed(bytes("{\"id\":1,\"ok\":true,\"result\":{\"uptime_ms\":42}}\n"))
        assertEquals(listOf(FramedLine.Json("{\"id\":1,\"ok\":true,\"result\":{\"uptime_ms\":42}}")), out)
    }

    @Test
    fun dropsAFirstLineThatIsTheBalancedLookingTailOfAnObject() {
        val framer = LineFramer()
        // Attached right before the nested object: the tail starts with "{" but closes the outer object.
        val out = framer.feed(bytes("{\"uptime_ms\":42}}\n{\"id\":2,\"ok\":true}\n"))
        assertEquals(listOf(FramedLine.Json("{\"id\":2,\"ok\":true}")), out)
    }

    @Test
    fun stripsCrAndSkipsEmptyLines() {
        val framer = LineFramer(dropFirstPartialLine = false)
        // The firmware sends one empty LF at boot before sys.boot.
        val out = framer.feed(bytes("\n{\"id\":1}\r\n\r\n"))
        assertEquals(listOf(FramedLine.Json("{\"id\":1}")), out)
    }

    @Test
    fun reportsNonJsonLinesAsNoise() {
        val framer = LineFramer(dropFirstPartialLine = false)
        val out = framer.feed(bytes("ESP-ROM:esp32s3-20210327\n{\"id\":2}\n"))
        assertEquals(listOf(FramedLine.Noise("ESP-ROM:esp32s3-20210327"), FramedLine.Json("{\"id\":2}")), out)
    }

    @Test
    fun discardsLinesLongerThan2048BytesIncludingLf() {
        val framer = LineFramer(dropFirstPartialLine = false)
        val exact = "{" + "a".repeat(MAX_LINE_BYTES - 3) + "}" // 2047 bytes + LF = 2048
        val tooLong = "{" + "a".repeat(MAX_LINE_BYTES - 2) + "}" // 2048 bytes + LF = 2049
        val out = framer.feed(bytes("$exact\n$tooLong\n{\"id\":3}\n"))
        assertEquals(listOf(FramedLine.Json(exact), FramedLine.TooLong, FramedLine.Json("{\"id\":3}")), out)
    }

    @Test
    fun joinsUtf8CharactersSplitAcrossUsbPackets() {
        val framer = LineFramer(dropFirstPartialLine = false)
        val line = bytes("{\"text\":\"Grüezi 👍\"}\n")
        val split = line.indexOf(0xC3.toByte()) + 1 // in the middle of "ü"
        val out = framer.feed(line, 0, split) + framer.feed(line, split, line.size - split)
        assertEquals(listOf(FramedLine.Json("{\"text\":\"Grüezi 👍\"}")), out)
    }
}
