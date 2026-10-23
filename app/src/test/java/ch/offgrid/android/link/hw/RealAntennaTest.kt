package ch.offgrid.android.link.hw

import ch.offgrid.android.crypto.FixedKeyUnlockTokenSource
import ch.offgrid.android.crypto.OgCrypto
import ch.offgrid.android.crypto.TokenWrap
import ch.offgrid.android.data.SettingDao
import ch.offgrid.android.data.SettingEntity
import ch.offgrid.android.domain.AntennaListener
import ch.offgrid.android.domain.AntennaManager
import ch.offgrid.android.domain.AntennaPhase
import ch.offgrid.android.domain.Messaging
import ch.offgrid.android.domain.Settings
import ch.offgrid.android.link.Incoming
import ch.offgrid.android.link.LinkClient
import ch.offgrid.android.link.LinkCommandException
import ch.offgrid.android.link.LinkSession
import ch.offgrid.android.link.LinkTimeoutException
import ch.offgrid.android.link.bool
import ch.offgrid.android.link.int
import ch.offgrid.android.link.long
import ch.offgrid.android.link.obj
import ch.offgrid.android.link.str
import ch.offgrid.android.link.tcp.TcpLink
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test

/**
 * Runs the app's link code against a real Heltec behind `lab/tools/bridge.py`. Skipped unless
 * `OFFGRID_TCP_LINK=host:port` is set, for example through an ssh tunnel to the machine the board
 * is plugged into:
 *
 * ```
 * ssh -L 7755:127.0.0.1:5555 lab-host python3 lab/tools/bridge.py /dev/ttyUSB0 5555
 * OFFGRID_TCP_LINK=127.0.0.1:7755 ./gradlew testDebugUnitTest --tests '*RealAntennaTest*'
 * ```
 *
 * The checks are written against the link spec and work with the team's serial mock as well as the
 * lab radio image; where the two differ (simulated versus real delivery), both outcomes are named.
 */
class RealAntennaTest {
    private val endpoint = System.getenv("OFFGRID_TCP_LINK").orEmpty()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val tokens = FixedKeyUnlockTokenSource(OgCrypto.sha256("hw-test-phone".toByteArray()))
    private val hello = buildJsonObject { put("app", "offgrid-android"); put("app_proto", "1.0") }
    private lateinit var link: TcpLink
    private var session: LinkSession? = null

    @Before
    fun setUp() {
        assumeTrue("OFFGRID_TCP_LINK not set, no hardware attached", endpoint.contains(':'))
        link = TcpLink(endpoint.substringBeforeLast(':'), endpoint.substringAfterLast(':').toInt())
    }

    @After
    fun tearDown() = scope.cancel()

    private fun log(text: String) = println("[hw] $text")

    private suspend fun connect(): LinkClient {
        val opened = link.open(link.find() ?: error("bridge not reachable at $endpoint"))
        session = opened
        return LinkClient(opened, scope, ::log)
    }

    private suspend fun helloWithRetry(c: LinkClient): JsonObject {
        repeat(20) {
            try {
                return c.call("sys.hello", hello, timeoutMs = 500)
            } catch (_: LinkTimeoutException) {
                log("hello timeout, retrying")
            }
        }
        error("no answer to sys.hello")
    }

    private fun wrapArgs(helloResult: JsonObject, token: ByteArray, name: String? = null) = buildJsonObject {
        val s = helloResult.obj("session")!!
        val deviceId = OgCrypto.unhex(helloResult.str("device_id")!!)
        val wrapped = TokenWrap.wrap(token, deviceId, OgCrypto.unb64(s.str("device_eph_pub")!!), OgCrypto.unb64(s.str("nonce")!!))
        put("app_eph_pub", OgCrypto.b64(wrapped.appEphPub))
        put("wrapped_token", OgCrypto.b64(wrapped.wrapped))
        if (name != null) put("name", name)
    }

    /** Opens the vault the way [AntennaManager] does: provision a fresh board, otherwise unlock. */
    private suspend fun unlock(c: LinkClient): JsonObject {
        val h = helloWithRetry(c)
        val token = tokens.token(OgCrypto.unhex(h.str("device_id")!!))
        when (h.str("state")) {
            "unprovisioned" -> c.call("sec.provision", wrapArgs(h, token, name = "HW Test"))
            "locked" -> c.call("sec.unlock", wrapArgs(h, token))
        }
        return h
    }

    private suspend fun expectError(code: String, block: suspend () -> Unit) {
        try {
            block()
            error("expected $code")
        } catch (e: LinkCommandException) {
            log("${e.cmd} -> ${e.error.code} (${e.error.message})")
            assertEquals(code, e.error.code)
        }
    }

    private suspend fun nextEvent(c: LinkClient, timeoutMs: Long, match: (Incoming.Event) -> Boolean): Incoming.Event? =
        withTimeoutOrNull(timeoutMs) {
            for (e in c.events) {
                log("event ${e.name} ${e.data}")
                if (match(e)) return@withTimeoutOrNull e
            }
            null
        }

    @Test
    fun helloUnlockAndReadOnlyCommands() = runBlocking {
        val c = connect()
        val h = unlock(c)
        log("hello: $h")
        assertEquals("1", h.str("proto")!!.substringBefore('.'))
        assertEquals(12, h.str("device_id")!!.length)
        val limits = h.obj("limits")!!
        assertTrue(limits.int("max_text_bytes")!! in 1..255)
        val status = c.call("sys.status")
        log("status: $status")
        assertEquals("unlocked", status.str("state"))
        val id = c.call("id.get")
        assertEquals(OgCrypto.nodeId(OgCrypto.unb64(id.str("public_key")!!)), id.str("node_id"))
        log("radio: ${c.call("radio.get")}")
        log("mesh: ${c.call("mesh.get")}")
        val t0 = c.call("sys.ping").long("uptime_ms")!!
        delay(200)
        assertTrue(c.call("sys.ping").long("uptime_ms")!! > t0)
        c.close()
    }

    @Test
    fun errorPathsMatchTheLinkSpec() = runBlocking {
        val c = connect()
        unlock(c)
        expectError("E_UNKNOWN_CMD") { c.call("does.not_exist") }
        // A hello session is single use: rotating to the same token consumes it, a second try must fail.
        val h = c.call("sys.hello", hello)
        val token = tokens.token(OgCrypto.unhex(h.str("device_id")!!))
        c.call("sec.rotate_token", wrapArgs(h, token))
        expectError("E_NO_SESSION") { c.call("sec.rotate_token", wrapArgs(h, token)) }
        expectError("E_NO_SUCH_CONTACT") { c.call("msg.send", buildJsonObject { put("to", 32); put("type", "text"); put("text", "x") }) }
        expectError("E_INVALID_ARG") { c.call("msg.send", buildJsonObject { put("to", "1"); put("type", "text"); put("text", "x") }) }
        expectError("E_INVALID_QR") {
            c.call("pair.begin")
            c.call("pair.complete", buildJsonObject { put("qr", "bm90LWFuLW9nMS1jb2Rl") })
        }
        c.call("pair.cancel")
        // A malformed line gets E_PARSE without an id; the client must ignore it and keep working.
        session!!.write("{\"id\":7,\"cmd\":\n".toByteArray())
        assertNotNull(c.call("sys.ping").long("uptime_ms"))
        c.close()
    }

    @Test
    fun pairBobFromTheSpecAndSendText() = runBlocking {
        val c = connect()
        unlock(c)
        c.call("pair.begin")
        val bob = bobQr()
        val pair = c.call("pair.complete", buildJsonObject { put("qr", bob); put("replace", true) })
        val contact = pair.obj("contact")!!
        log("paired: $contact")
        assertEquals("E841", contact.str("node_id"))
        val slot = contact.int("contact_id")!!
        expectError("E_TOO_LONG") {
            c.call("msg.send", buildJsonObject { put("to", slot); put("type", "text"); put("text", "ä".repeat(42)) })
        }
        val sent = c.call("msg.send", buildJsonObject { put("to", slot); put("type", "text"); put("text", "Hallo vom Hardwaretest"); put("ack", true); put("hops", 0) })
        log("msg.send: $sent")
        val ref = sent.long("msg_ref")!!
        val states = mutableListOf<String>()
        // Lab radio image: sent after TxDone, then three retries and failed(timeout) without a second
        // antenna: about 32 s at SF9 with hops 0, over 2 min with the default 3 hops (protocol 12.2 scales the
        // timeout with 2 x hops + 2). Team mock: sent, relayed, delivered on short timers. The heartbeat
        // keeps the board from locking (and failing the message with reason locked) while we wait.
        val heartbeat = scope.launch { while (true) { delay(5_000); c.call("sys.ping") } }
        val last = nextEvent(c, 120_000) { e ->
            if (e.name == "msg.status" && e.data.long("msg_ref") == ref) states += e.data.str("state")!!
            e.name == "msg.status" && e.data.long("msg_ref") == ref && e.data.str("state") in setOf("delivered", "failed")
        }
        heartbeat.cancel()
        log("states: $states")
        assertTrue(states.firstOrNull() == "sent")
        assertTrue(last?.data?.str("state") == "delivered" || last?.data?.str("reason") == "timeout")
        // The pairing ping (empty reaction, ref 0) the app sends right after pair.complete. The team mock up
        // to ed9fd57 rejects every reaction ("target must be an object": `is<JsonObject>()` on a const view),
        // so there it is recorded, not asserted; the lab image must accept it.
        val lab = c.call("sys.hello", hello).bool("lab_radio") == true
        try {
            val ping = c.call("msg.send", Messaging.pingArgs(slot))
            log("ping: $ping")
            assertEquals(true, ping.bool("ack_requested"))
        } catch (e: LinkCommandException) {
            log("ping rejected: ${e.error}")
            assertTrue("lab image must accept reactions", !lab && e.error.field == "target")
        }
        c.close()
    }

    @Test
    fun heartbeatTimeoutLocksAndUnlockRecovers() = runBlocking {
        val c = connect()
        unlock(c)
        val timeout = c.call("sec.get_policy").int("lock_timeout_s")!!
        assumeTrue("auto-lock disabled on this board", timeout in 1..30)
        val locked = nextEvent(c, (timeout + 5) * 1_000L) { it.name == "sec.state" && it.data.str("state") == "locked" }
        assertNotNull("no sec.state locked after $timeout s without heartbeat", locked)
        expectError("E_LOCKED") { c.call("id.get") }
        unlock(c)
        assertEquals("unlocked", c.call("sys.status").str("state"))
        c.close()
    }

    @Test
    fun reconnectDoesNotResetTheBoard() = runBlocking {
        val first = connect()
        unlock(first)
        val up = first.call("sys.ping").long("uptime_ms")!!
        first.close()
        delay(300)
        val second = connect()
        val h = helloWithRetry(second)
        assertTrue("board rebooted on reconnect", second.call("sys.ping").long("uptime_ms")!! > up)
        assertTrue(h.str("state") != "unprovisioned")
        second.close()
    }

    /** The app's own connection manager, end to end: hello, provision/unlock, radio.get, id.get, READY. */
    @Test
    fun antennaManagerReachesReady() = runBlocking {
        val settings = Settings(MemorySettingDao(), scope)
        val events = Channel<String>(Channel.UNLIMITED)
        val manager = AntennaManager(scope, { link }, tokens, settings, ::log)
        manager.listener = object : AntennaListener {
            override suspend fun onReady(antenna: AntennaManager, deviceId: String) { events.trySend("ready $deviceId") }
            override suspend fun onEvent(event: Incoming.Event) { events.trySend(event.name) }
            override suspend fun onDeviceRebooted() { events.trySend("rebooted") }
        }
        manager.connect()
        val state = withTimeout(15_000) { manager.state.first { it.phase == AntennaPhase.READY || it.phase == AntennaPhase.ERROR } }
        log("antenna state: $state")
        assertEquals(AntennaPhase.READY, state.phase)
        assertNotNull(state.nodeId)
        assertTrue(withTimeout(2_000) { events.receive() }.startsWith("ready"))
        // Heartbeat keeps the board unlocked past its lock timeout.
        delay(20_000)
        assertEquals("unlocked", manager.call("sys.status").str("state"))
        manager.disconnect()
    }

    private class MemorySettingDao : SettingDao {
        private val map = MutableStateFlow<Map<String, String>>(emptyMap())
        override fun observeAll(): Flow<List<SettingEntity>> = map.map { m -> m.map { SettingEntity(it.key, it.value) } }
        override suspend fun get(key: String): String? = map.value[key]
        override suspend fun put(setting: SettingEntity) { map.value = map.value + (setting.key to setting.value) }
        override suspend fun remove(key: String) { map.value = map.value - key }
    }

    companion object {
        /** Bob from protocol spec 15.1: private key SHA256("bob"), salt 20..2F, name "Bob". */
        fun bobQr(): String {
            val bobPublic = OgCrypto.x25519PublicKey(OgCrypto.sha256("bob".toByteArray()))
            val salt = ByteArray(16) { (0x20 + it).toByte() }
            return OgCrypto.b64("OG1".toByteArray() + bobPublic + salt + "Bob".toByteArray())
        }
    }
}
