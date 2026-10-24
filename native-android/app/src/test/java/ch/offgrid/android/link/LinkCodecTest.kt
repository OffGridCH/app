package ch.offgrid.android.link

import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LinkCodecTest {
    @Test
    fun encodesARequestAsOneLfTerminatedLine() {
        val line = LinkCodec.encodeRequest(7, "msg.send", buildJsonObject { put("to", 1); put("type", "text"); put("text", "Hoi") })
            .toString(Charsets.UTF_8)
        assertEquals("{\"id\":7,\"cmd\":\"msg.send\",\"args\":{\"to\":1,\"type\":\"text\",\"text\":\"Hoi\"}}\n", line)
    }

    @Test
    fun decodesSuccessErrorAndEvent() {
        val ok = LinkCodec.decodeIncoming("{\"id\":1,\"ok\":true,\"result\":{\"uptime_ms\":6420}}") as Incoming.Response
        assertEquals(1L, ok.id)
        assertEquals(6420L, ok.result.long("uptime_ms"))

        val err = LinkCodec.decodeIncoming("{\"id\":2,\"ok\":false,\"error\":{\"code\":\"E_TOO_LONG\",\"message\":\"x\",\"field\":\"text\"}}")
            as Incoming.Response
        assertEquals(LinkError("E_TOO_LONG", "x", "text"), err.error)

        val evt = LinkCodec.decodeIncoming("{\"evt\":\"msg.status\",\"t\":2210,\"data\":{\"msg_ref\":1,\"state\":\"sent\"}}") as Incoming.Event
        assertEquals("msg.status", evt.name)
        assertEquals("sent", evt.data.str("state"))
    }

    @Test
    fun acceptsTheFirmwareParseErrorWithoutId() {
        // The firmware answers a blank or broken line with an error that carries no id.
        val parse = LinkCodec.decodeIncoming("{\"ok\":false,\"error\":{\"code\":\"E_PARSE\",\"message\":\"invalid JSON\"}}") as Incoming.Response
        assertNull(parse.id)
        assertEquals("E_PARSE", parse.error?.code)
    }

    @Test
    fun readsTheFirmwaresFloatRssi() {
        // msg.received and contact views carry RSSI and SNR as floats (Commands.cpp, Contacts::View).
        val event = LinkCodec.decodeIncoming("{\"evt\":\"msg.received\",\"t\":5,\"data\":{\"rssi\":-91.6,\"snr\":7.25,\"last_rssi\":-85}}")
            as Incoming.Event
        assertNull(event.data.int("rssi"))
        assertEquals(-92, event.data.dbm("rssi"))
        assertEquals(-85, event.data.dbm("last_rssi"))
        assertEquals(7.25, event.data.double("snr")!!, 0.0)
        assertNull(event.data.dbm("missing"))
    }

    @Test
    fun ignoresGarbage() {
        assertNull(LinkCodec.decodeIncoming("{not json"))
        assertNull(LinkCodec.decodeIncoming("{\"foo\":1}"))
    }

    @Test
    fun refusesToEncodeLinesOver2048Bytes() {
        val result = runCatching { LinkCodec.encodeRequest(1, "msg.send", buildJsonObject { put("text", "a".repeat(2100)) }) }
        assertTrue(result.exceptionOrNull() is LineTooLongException)
    }
}
