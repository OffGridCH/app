package ch.offgrid.android.link

import kotlinx.serialization.json.JsonObject
import java.io.ByteArrayOutputStream

/** Maximum line length in bytes including the newline, in both directions (link spec section 3.2). */
const val MAX_LINE_BYTES = 2048

/** One unit produced by [LineFramer]. */
sealed interface FramedLine {
    /** A line that starts with `{` and is a candidate JSON object. */
    data class Json(val text: String) : FramedLine

    /** Non-JSON output such as ESP32 ROM boot text (spec 3.3: ignored). */
    data class Noise(val text: String) : FramedLine

    /** A line exceeded [MAX_LINE_BYTES] and was dropped up to the next newline. */
    data object TooLong : FramedLine
}

/**
 * Splits a raw USB serial byte stream into JSON Lines as defined in the OffGrid link spec.
 *
 * Rules implemented here (spec 3.2 and 3.3):
 * - lines end with LF, a trailing CR is tolerated and stripped;
 * - after connecting, the first line may be the tail of a line we attached in the middle of. It is
 *   dropped unless it is a complete JSON object: a proper suffix of an object line can never parse
 *   as an object, because its closing brace belongs to an opening brace outside the suffix. Over the
 *   Heltec's UART bridge nothing is in flight when the port opens, so dropping blindly (the spec's
 *   wording) threw away the answer to the first `sys.hello` and cost every connect a 500 ms retry;
 * - lines longer than 2048 bytes (including the LF) are discarded up to the next LF;
 * - lines that do not start with `{` are reported as noise and must be ignored by the caller;
 * - empty lines are skipped silently (the device sends one empty LF at boot).
 *
 * Bytes are buffered until a full line arrives, so multi-byte UTF-8 characters split across USB
 * packets decode correctly.
 */
class LineFramer(
    private val maxLineBytes: Int = MAX_LINE_BYTES,
    dropFirstPartialLine: Boolean = true,
) {
    private val buffer = ByteArrayOutputStream()
    private var firstLine = dropFirstPartialLine
    private var overflowed = false

    fun feed(bytes: ByteArray, offset: Int = 0, length: Int = bytes.size - offset): List<FramedLine> {
        val out = mutableListOf<FramedLine>()
        for (i in offset until offset + length) {
            val b = bytes[i]
            if (b == LF) {
                when {
                    overflowed -> {
                        overflowed = false
                        if (!firstLine) out += FramedLine.TooLong
                    }
                    firstLine -> emitIfCompleteObject(out)
                    else -> emit(out)
                }
                firstLine = false
                buffer.reset()
                continue
            }
            if (overflowed) continue
            buffer.write(b.toInt())
            // The limit counts the terminating LF, so content may use at most maxLineBytes - 1 bytes.
            if (buffer.size() > maxLineBytes - 1) {
                overflowed = true
                buffer.reset()
            }
        }
        return out
    }

    private fun emitIfCompleteObject(out: MutableList<FramedLine>) {
        val candidate = mutableListOf<FramedLine>()
        emit(candidate)
        val line = candidate.singleOrNull() as? FramedLine.Json ?: return
        val complete = runCatching { LinkCodec.json.parseToJsonElement(line.text) is JsonObject }.getOrDefault(false)
        if (complete) out += line
    }

    private fun emit(out: MutableList<FramedLine>) {
        var raw = buffer.toByteArray()
        if (raw.isNotEmpty() && raw.last() == CR) raw = raw.copyOf(raw.size - 1)
        if (raw.isEmpty()) return
        val text = raw.toString(Charsets.UTF_8)
        out += if (text.trimStart().startsWith("{")) FramedLine.Json(text) else FramedLine.Noise(text)
    }

    private companion object {
        const val LF: Byte = 0x0A
        const val CR: Byte = 0x0D
    }
}
