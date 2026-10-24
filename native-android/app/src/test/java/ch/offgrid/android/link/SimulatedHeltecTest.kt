package ch.offgrid.android.link

import ch.offgrid.android.crypto.FixedKeyUnlockTokenSource
import ch.offgrid.android.crypto.OgCrypto
import ch.offgrid.android.crypto.TokenWrap
import ch.offgrid.android.link.sim.SimFlashStore
import ch.offgrid.android.link.sim.SimulatedHeltec
import ch.offgrid.android.link.sim.SimulatedLink
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Test

/** The simulated antenna end to end through the real framing and client, as the app uses it. */
class SimulatedHeltecTest {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val device = SimulatedHeltec(SimFlashStore(null), scope)
    private val link = SimulatedLink(device)
    private val tokens = FixedKeyUnlockTokenSource(OgCrypto.sha256("test-phone".toByteArray()))
    private val hello = buildJsonObject { put("app", "offgrid-android"); put("app_proto", "1.0") }

    @After
    fun tearDown() = scope.cancel()

    private suspend fun connect(): LinkClient = LinkClient(link.open(link.find()!!), scope)

    private fun wrapArgs(session: JsonObject, deviceId: String, token: ByteArray) = buildJsonObject {
        val s = session.obj("session")!!
        val wrapped = TokenWrap.wrap(token, OgCrypto.unhex(deviceId), OgCrypto.unb64(s.str("device_eph_pub")!!), OgCrypto.unb64(s.str("nonce")!!))
        put("app_eph_pub", OgCrypto.b64(wrapped.appEphPub))
        put("wrapped_token", OgCrypto.b64(wrapped.wrapped))
        put("name", "HolyG")
    }

    private suspend fun LinkClient.awaitEvent(name: String, match: (JsonObject) -> Boolean): JsonObject = withTimeout(10_000) {
        var found: JsonObject? = null
        while (found == null) {
            val e = events.receive()
            if (e.name == name && match(e.data)) found = e.data
        }
        found
    }

    @Test
    fun provisionPairSendAndDeliver() = runBlocking {
        val client = connect()
        val h = client.call("sys.hello", hello)
        assertEquals("unprovisioned", h.str("state"))
        assertEquals(83, h.obj("limits")!!.int("max_text_bytes"))
        val deviceId = h.str("device_id")!!
        assertEquals("unlocked", client.call("sec.provision", wrapArgs(h, deviceId, tokens.token(OgCrypto.unhex(deviceId)))).str("state"))

        val qr = device.addVirtualPeer("Anna Meier", -92)
        client.call("pair.begin")
        val contact = client.call("pair.complete", buildJsonObject { put("qr", qr) }).obj("contact")!!
        assertEquals("pending", contact.str("state"))
        val slot = contact.int("contact_id")!!

        val sent = client.call("msg.send", buildJsonObject { put("to", slot); put("type", "text"); put("text", "Grüezi"); put("ack", true) })
        val ref = sent.int("msg_ref")!!
        client.awaitEvent("msg.status") { it.int("msg_ref") == ref && it.str("state") == "delivered" }

        val tooLong = runCatching {
            client.call("msg.send", buildJsonObject { put("to", slot); put("type", "text"); put("text", "a".repeat(84)) })
        }.exceptionOrNull() as LinkCommandException
        assertEquals("E_TOO_LONG", tooLong.error.code)
        client.close()
    }

    @Test
    fun anotherPhonesTokenIsRejected() = runBlocking {
        val client = connect()
        val h = client.call("sys.hello", hello)
        val deviceId = h.str("device_id")!!
        client.call("sec.provision", wrapArgs(h, deviceId, tokens.token(OgCrypto.unhex(deviceId))))
        client.call("sec.lock")

        val other = FixedKeyUnlockTokenSource(OgCrypto.sha256("other-phone".toByteArray()))
        val h2 = client.call("sys.hello", hello)
        val error = runCatching { client.call("sec.unlock", wrapArgs(h2, deviceId, other.token(OgCrypto.unhex(deviceId)))) }
            .exceptionOrNull() as LinkCommandException
        assertEquals("E_UNLOCK_FAILED", error.error.code)

        val h3 = client.call("sys.hello", hello)
        assertEquals("unlocked", client.call("sec.unlock", wrapArgs(h3, deviceId, tokens.token(OgCrypto.unhex(deviceId)))).str("state"))
        client.close()
    }
}
