package ch.offgrid.android.link

import ch.offgrid.android.crypto.FixedKeyUnlockTokenSource
import ch.offgrid.android.crypto.OgCrypto
import ch.offgrid.android.crypto.TokenWrap
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
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** The simulator without the lab image follows Nils' team firmware 0.3.0 (link spec on `feature/firmware-hardening`). */
class SimulatedHeltecTeamTest {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val timing = SimTiming(firstTxMs = 20, ackWaitMs = 40, retryMs = 40, retries = 2)
    private val device = SimulatedHeltec(SimFlashStore(null), scope, timing = timing, labRadio = false)
    private val link = SimulatedLink(device)
    private val tokens = FixedKeyUnlockTokenSource(OgCrypto.sha256("test-phone".toByteArray()))
    private val hello = buildJsonObject { put("app", "offgrid-android"); put("app_proto", "1.0") }

    @After
    fun tearDown() = scope.cancel()

    private suspend fun provisioned(): LinkClient {
        val c = LinkClient(link.open(link.find()!!), scope)
        val h = c.call("sys.hello", hello)
        val deviceId = h.str("device_id")!!
        val s = h.obj("session")!!
        val w = TokenWrap.wrap(tokens.token(OgCrypto.unhex(deviceId)), OgCrypto.unhex(deviceId),
            OgCrypto.unb64(s.str("device_eph_pub")!!), OgCrypto.unb64(s.str("nonce")!!))
        c.call("sec.provision", buildJsonObject { put("app_eph_pub", OgCrypto.b64(w.appEphPub)); put("wrapped_token", OgCrypto.b64(w.wrapped)) })
        return c
    }

    private suspend fun LinkClient.errorOf(cmd: String, args: JsonObject? = null): String =
        (runCatching { call(cmd, args) }.exceptionOrNull() as LinkCommandException).error.code

    @Test
    fun helloHasNoLabFieldsAndMockIsFalse() = runBlocking {
        val c = provisioned()
        val h = c.call("sys.hello", hello)
        assertNull(h["lab_radio"])
        assertEquals(false, h.bool("mock"))
        assertEquals("og-reset-wrap-v1", h.obj("recovery")!!.str("app_wrap_label"))
        assertEquals("E_UNKNOWN_CMD", c.errorOf("lab.get"))
        c.close()
    }

    @Test
    fun everyPairBeginDrawsANewSaltAndCompletionEndsTheSession() = runBlocking {
        val c = provisioned()
        val first = c.call("pair.begin").str("qr")
        assertNotEquals(first, c.call("pair.begin").str("qr"))
        c.call("pair.complete", buildJsonObject { put("qr", device.addVirtualPeer("Anna", -80)) })
        assertEquals("E_NO_PAIRING", c.errorOf("pair.complete", buildJsonObject { put("qr", device.addVirtualPeer("Ben", -80)) }))
        c.close()
    }

    @Test
    fun noAckAfterTheRetriesFailsWithTimeoutAndPendingHasNoRecent() = runBlocking {
        val c = provisioned()
        val qr = device.addVirtualPeer("Mia", -90, inRange = false)
        c.call("pair.begin")
        val slot = c.call("pair.complete", buildJsonObject { put("qr", qr) }).obj("contact")!!.int("contact_id")!!
        val sent = c.call("msg.send", buildJsonObject { put("to", slot); put("type", "text"); put("text", "Hallo") })
        assertNull(sent["compressed"])
        val ref = sent.int("msg_ref")!!
        val failed = withTimeout(5_000) {
            var found: JsonObject? = null
            while (found == null) {
                val e = c.events.receive()
                assertNotEquals("waiting", e.data.str("state"))
                if (e.name == "msg.status" && e.data.int("msg_ref") == ref && e.data.str("state") == "failed") found = e.data
            }
            found
        }
        assertEquals("timeout", failed.str("reason"))
        val pending = c.call("msg.pending")
        assertFalse(pending.containsKey("recent"))
        assertEquals("E_TOO_LONG", c.errorOf("msg.send", buildJsonObject { put("to", slot); put("type", "text"); put("text", "x".repeat(84)) }))
        c.close()
    }
}
