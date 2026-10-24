package ch.offgrid.android.link

import ch.offgrid.android.crypto.FixedKeyUnlockTokenSource
import ch.offgrid.android.crypto.OgCrypto
import ch.offgrid.android.crypto.TokenWrap
import ch.offgrid.android.crypto.WrapPurpose
import ch.offgrid.android.domain.MessageLimits
import ch.offgrid.android.link.sim.SimFlashStore
import ch.offgrid.android.link.sim.SimTiming
import ch.offgrid.android.link.sim.SimulatedHeltec
import ch.offgrid.android.link.sim.SimulatedLink
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** The simulator follows the lab.3 host contract the app is written against (no hardware involved). */
class SimulatedHeltecLab3Test {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val timing = SimTiming(firstTxMs = 20, ackWaitMs = 40, retryMs = 40, retries = 2, resendMs = 150, parkMs = 1_500)
    private val device = SimulatedHeltec(SimFlashStore(null), scope, timing = timing)
    private val link = SimulatedLink(device)
    private val tokens = FixedKeyUnlockTokenSource(OgCrypto.sha256("test-phone".toByteArray()))
    private val hello = buildJsonObject { put("app", "offgrid-android"); put("app_proto", "1.0") }
    private lateinit var deviceId: String

    @After
    fun tearDown() = scope.cancel()

    private suspend fun connect(): LinkClient = LinkClient(link.open(link.find()!!), scope)

    private fun wrapArgs(h: JsonObject, purpose: WrapPurpose = WrapPurpose.UNLOCK, token: ByteArray = token()) = buildJsonObject {
        val s = h.obj("session")!!
        val w = TokenWrap.wrap(token, OgCrypto.unhex(deviceId), OgCrypto.unb64(s.str("device_eph_pub")!!), OgCrypto.unb64(s.str("nonce")!!), purpose)
        put("app_eph_pub", OgCrypto.b64(w.appEphPub))
        put("wrapped_token", OgCrypto.b64(w.wrapped))
    }

    private fun token() = tokens.token(OgCrypto.unhex(deviceId))

    private suspend fun LinkClient.provisioned(): LinkClient {
        val h = call("sys.hello", hello)
        deviceId = h.str("device_id")!!
        call("sec.provision", wrapArgs(h))
        return this
    }

    private suspend fun LinkClient.pair(name: String, inRange: Boolean = true): Int {
        val qr = device.addVirtualPeer(name, -90, inRange = inRange)
        call("pair.begin")
        return call("pair.complete", buildJsonObject { put("qr", qr) }).obj("contact")!!.int("contact_id")!!
    }

    private suspend fun LinkClient.send(slot: Int, text: String = "Hallo") =
        call("msg.send", buildJsonObject { put("to", slot); put("type", "text"); put("text", text); put("ack", true) })

    private suspend fun LinkClient.awaitStatus(ref: Int, state: String): JsonObject = withTimeout(10_000) {
        var found: JsonObject? = null
        while (found == null) {
            val e = events.receive()
            if (e.name == "msg.status" && e.data.int("msg_ref") == ref && e.data.str("state") == state) found = e.data
        }
        found
    }

    private suspend fun LinkClient.pending(): Pair<List<JsonObject>, List<JsonObject>> {
        val r = call("msg.pending")
        fun list(key: String) = (r[key] as JsonArray).map { it as JsonObject }
        return list("pending") to list("recent")
    }

    private suspend fun LinkClient.errorOf(cmd: String, args: JsonObject? = null): String =
        (runCatching { call(cmd, args) }.exceptionOrNull() as LinkCommandException).error.code

    @Test
    fun helloAnnouncesTheLabRadioAndRefsStartRandomly() = runBlocking {
        val c = connect().provisioned()
        val h = c.call("sys.hello", hello)
        assertEquals(true, h.bool("lab_radio"))
        assertEquals("raw", h.str("text_codec"))
        assertEquals("0.2.0-lab.3-sim", h.obj("fw")!!.str("version"))
        val slot = c.pair("Anna")
        val first = c.send(slot).int("msg_ref")!!
        assertTrue(first in 1..(1 shl 30))
        assertEquals(first + 1, c.send(slot).int("msg_ref"))
        c.close()
    }

    @Test
    fun deliveredMessagesLandInRecentNewestFirst() = runBlocking {
        val c = connect().provisioned()
        val slot = c.pair("Anna")
        val a = c.send(slot).int("msg_ref")!!
        c.awaitStatus(a, "delivered")
        val b = c.send(slot).int("msg_ref")!!
        c.awaitStatus(b, "delivered")
        val (pending, recent) = c.pending()
        assertTrue(pending.isEmpty())
        assertEquals(listOf(b, a), recent.map { it.int("msg_ref") })
        assertEquals("delivered", recent.first().str("state"))
        c.close()
    }

    @Test
    fun unansweredMessageWaitsThenDeliversWhenTheContactIsHeardAgain() = runBlocking {
        val c = connect().provisioned()
        val slot = c.pair("Mia", inRange = false)
        val ref = c.send(slot).int("msg_ref")!!
        val waiting = c.awaitStatus(ref, "waiting")
        assertEquals("no_ack", waiting.str("reason"))
        val item = c.pending().first.single()
        assertEquals("waiting", item.str("state"))
        assertEquals(ref, item.int("msg_ref"))

        device.setPeerInRange(slot, true)
        device.peerSays(slot, "Bin wieder da")
        c.awaitStatus(ref, "delivered")
        assertEquals("delivered", c.pending().second.first { it.int("msg_ref") == ref }.str("state"))
        c.close()
    }

    @Test
    fun waitingEndsAsTimeoutAfterTheParkTime() = runBlocking {
        val c = connect().provisioned()
        val slot = c.pair("Mia", inRange = false)
        val ref = c.send(slot).int("msg_ref")!!
        assertEquals("timeout", c.awaitStatus(ref, "failed").str("reason"))
        val recent = c.pending().second.single()
        assertEquals("failed", recent.str("state"))
        assertEquals("timeout", recent.str("reason"))
        c.close()
    }

    @Test
    fun lockFailsPendingAndRebootForgetsQueueAndRecent() = runBlocking {
        val c = connect().provisioned()
        val slot = c.pair("Mia", inRange = false)
        val ref = c.send(slot).int("msg_ref")!!
        c.call("sec.lock")
        assertEquals("locked", c.awaitStatus(ref, "failed").str("reason"))
        c.call("sec.unlock", wrapArgs(c.call("sys.hello", hello)))
        assertEquals("locked", c.pending().second.single { it.int("msg_ref") == ref }.str("reason"))

        val beforeReboot = c.send(slot).int("msg_ref")!!
        device.powerCycle()
        c.call("sec.unlock", wrapArgs(c.call("sys.hello", hello)))
        val (pending, recent) = c.pending()
        assertTrue(pending.isEmpty() && recent.isEmpty())
        assertNotEquals(beforeReboot + 1, c.send(slot).int("msg_ref"))
        c.close()
    }

    @Test
    fun cancelAnswersOnlyForPendingMessages() = runBlocking {
        val c = connect().provisioned()
        val slot = c.pair("Mia", inRange = false)
        val ref = c.send(slot).int("msg_ref")!!
        assertEquals("cancelled", c.call("msg.cancel", buildJsonObject { put("msg_ref", ref) }).str("state"))
        c.awaitStatus(ref, "cancelled")
        assertEquals("E_INVALID_ARG", c.errorOf("msg.cancel", buildJsonObject { put("msg_ref", ref) }))
        c.close()
    }

    @Test
    fun factoryResetNeedsTheResetEnvelope() = runBlocking {
        val c = connect().provisioned()
        c.pair("Anna")
        val erase = { h: JsonObject, purpose: WrapPurpose ->
            buildJsonObject {
                put("confirm", "ERASE"); put("method", "app")
                wrapArgs(h, purpose).forEach { (k, v) -> put(k, v) }
            }
        }
        assertEquals("E_CONFIRM_REQUIRED", c.errorOf("sys.factory_reset", buildJsonObject { put("confirm", "yes") }))
        val unlockEnvelope = erase(c.call("sys.hello", hello), WrapPurpose.UNLOCK)
        assertEquals("E_UNLOCK_FAILED", c.errorOf("sys.factory_reset", unlockEnvelope))
        // The failed attempt used up the session (spec 6.7), so the same envelope cannot be tried again.
        assertEquals("E_NO_SESSION", c.errorOf("sys.factory_reset", unlockEnvelope))

        assertEquals(true, c.call("sys.factory_reset", erase(c.call("sys.hello", hello), WrapPurpose.RESET)).bool("pending"))
        withTimeout(5_000) { while (true) { val e = c.events.receive(); if (e.name == "sys.boot") break } }
        val h = c.call("sys.hello", hello)
        assertEquals("unprovisioned", h.str("state"))
        assertEquals(deviceId, h.str("device_id"))
        c.call("sec.provision", wrapArgs(h))
        assertEquals(0, c.call("contact.list", buildJsonObject { put("offset", 0); put("limit", 10) }).int("total"))
        c.close()
    }

    @Test
    fun ogz1AcceptsLongerTextWhenItCompresses() = runBlocking {
        val c = connect().provisioned()
        val slot = c.pair("Anna")
        val text = "Wir sind bei der Hütte und kommen in etwa zwanzig Minuten. Wartest du dort auf uns oder gehst du weiter?"
        assertTrue(text.toByteArray().size in 84..160)
        assertEquals("E_TOO_LONG", c.errorOf("msg.send", buildJsonObject { put("to", slot); put("type", "text"); put("text", text) }))
        val lab = c.call("lab.set", buildJsonObject { put("text_codec", "ogz1") })
        assertEquals(160, lab.int("max_text_input_bytes"))
        assertEquals("ogz1", c.call("sys.hello", hello).str("text_codec"))
        assertTrue(MessageLimits.onAirTextBytes(text, MessageLimits.CODEC_OGZ1, 160) <= 83)
        val sent = c.call("msg.send", buildJsonObject { put("to", slot); put("type", "text"); put("text", text) })
        assertTrue(sent.int("bytes_on_air")!! < 17 + text.toByteArray().size)
        c.close()
    }
}
