package ch.offgrid.android.domain

import ch.offgrid.android.crypto.OgCrypto
import ch.offgrid.android.crypto.TokenWrap
import ch.offgrid.android.crypto.UnlockTokenSource
import ch.offgrid.android.link.Incoming
import ch.offgrid.android.link.Link
import ch.offgrid.android.link.LinkClient
import ch.offgrid.android.link.LinkClosedException
import ch.offgrid.android.link.LinkCommandException
import ch.offgrid.android.link.LinkError
import ch.offgrid.android.link.LinkKind
import ch.offgrid.android.link.LinkOpenException
import ch.offgrid.android.link.LinkTimeoutException
import ch.offgrid.android.link.OpenError
import ch.offgrid.android.link.double
import ch.offgrid.android.link.int
import ch.offgrid.android.link.obj
import ch.offgrid.android.link.str
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

enum class AntennaPhase { DISCONNECTED, SEARCHING, DEVICE_FOUND, CONNECTING, READY, ERROR }

/** UI error codes, texts in the screen spec ("Fehlertexte"). */
enum class AntennaError { NO_DEVICE, PERMISSION_DENIED, OPEN_FAILED, NO_INFO, PROTO_MISMATCH, LOST, UNLOCK_FAILED }

data class AntennaState(
    val phase: AntennaPhase = AntennaPhase.DISCONNECTED,
    val kind: LinkKind = LinkKind.SIMULATED,
    val deviceLabel: String? = null,
    val fwVersion: String? = null,
    val freqMhz: Double? = null,
    val deviceId: String? = null,
    val nodeId: String? = null,
    val maxTextBytes: Int = MessageLimits.DEFAULT_MAX_TEXT_BYTES,
    val error: AntennaError? = null,
) {
    val ready: Boolean get() = phase == AntennaPhase.READY
    val busy: Boolean get() = phase == AntennaPhase.SEARCHING || phase == AntennaPhase.DEVICE_FOUND || phase == AntennaPhase.CONNECTING
}

/** Receives device events and the "ready" signal; implemented by [Messaging]. */
interface AntennaListener {
    suspend fun onReady(antenna: AntennaManager, deviceId: String)
    suspend fun onEvent(event: Incoming.Event)
    suspend fun onDeviceRebooted()
}

/**
 * Owns the connection to the antenna: open the link, `sys.hello`, provision or unlock the vault
 * with the Keystore token, heartbeat every 5 s, and re-unlock after a reboot or auto-lock.
 */
class AntennaManager(
    private val scope: CoroutineScope,
    private val linkProvider: () -> Link,
    private val tokenSource: UnlockTokenSource,
    private val settings: Settings,
    private val log: (String) -> Unit = {},
) {
    private val _state = MutableStateFlow(AntennaState())
    val state: StateFlow<AntennaState> = _state.asStateFlow()

    lateinit var listener: AntennaListener

    private var sessionJob: Job? = null
    private var client: LinkClient? = null
    private val unlockMutex = Mutex()

    fun connect() {
        if (state.value.busy || state.value.ready) return
        val previous = sessionJob
        sessionJob = scope.launch {
            previous?.cancelAndJoin()
            runSession()
        }
    }

    fun disconnect() {
        sessionJob?.cancel()
        client?.close()
        client = null
        _state.update { it.copy(phase = AntennaPhase.DISCONNECTED, error = null) }
    }

    /** Sends a command on the open link. Throws [LinkClosedException] when the antenna is not ready. */
    suspend fun call(cmd: String, args: JsonObject? = null): JsonObject {
        val c = client ?: throw LinkClosedException()
        if (!state.value.ready && !cmd.startsWith("sys.")) throw LinkClosedException()
        return c.call(cmd, args)
    }

    private suspend fun runSession() {
        val link = linkProvider()
        _state.value = AntennaState(phase = AntennaPhase.SEARCHING, kind = link.kind)
        val found = link.find() ?: return fail(AntennaError.NO_DEVICE)
        _state.update { it.copy(phase = AntennaPhase.DEVICE_FOUND, deviceLabel = found.label) }
        val session = try {
            link.open(found)
        } catch (e: LinkOpenException) {
            return fail(
                when (e.error) {
                    OpenError.NO_DEVICE -> AntennaError.NO_DEVICE
                    OpenError.PERMISSION_DENIED -> AntennaError.PERMISSION_DENIED
                    OpenError.OPEN_FAILED -> AntennaError.OPEN_FAILED
                },
            )
        }
        _state.update { it.copy(phase = AntennaPhase.CONNECTING) }
        val c = LinkClient(session, scope, log)
        client = c
        val eventJob = scope.launch { for (event in c.events) handleEvent(event) }
        try {
            val hello = helloWithRetry(c)
            val proto = hello.str("proto") ?: "0.0"
            if (proto.substringBefore('.') != PROTO_MAJOR) return fail(AntennaError.PROTO_MISMATCH)
            val deviceId = hello.str("device_id") ?: return fail(AntennaError.NO_INFO)
            val maxText = hello.obj("limits")?.int("max_text_bytes") ?: MessageLimits.DEFAULT_MAX_TEXT_BYTES
            val chip = hello.str("chip")?.substringBefore('-')
            _state.update {
                it.copy(deviceId = deviceId, maxTextBytes = maxText, fwVersion = hello.obj("fw")?.str("version"),
                    deviceLabel = chip ?: it.deviceLabel)
            }
            if (!unlock(c, hello)) return fail(AntennaError.UNLOCK_FAILED)
            val radio = c.call("radio.get")
            val identity = c.call("id.get")
            identity.str("public_key")?.let { settings.put(Settings.OWN_PUBLIC_KEY, it) }
            _state.update {
                it.copy(phase = AntennaPhase.READY, freqMhz = radio.double("freq_mhz"), nodeId = identity.str("node_id"), error = null)
            }
            listener.onReady(this, deviceId)
            val heartbeat = scope.launch { heartbeat(c) }
            val cause = c.closed.await()
            heartbeat.cancel()
            fail(if (cause != null) AntennaError.LOST else null)
        } catch (_: LinkTimeoutException) {
            fail(AntennaError.NO_INFO)
        } catch (_: LinkClosedException) {
            fail(AntennaError.LOST)
        } catch (e: LinkCommandException) {
            log("session failed: ${e.error.code}")
            fail(if (e.error.code == "E_PROTO_MISMATCH") AntennaError.PROTO_MISMATCH else AntennaError.NO_INFO)
        } finally {
            eventJob.cancel()
        }
    }

    private fun fail(error: AntennaError?) {
        client?.close()
        client = null
        _state.update { it.copy(phase = if (error == null) AntennaPhase.DISCONNECTED else AntennaPhase.ERROR, error = error) }
    }

    /** Link spec 3.3: commands sent during boot are lost, so retry `sys.hello` every 500 ms. */
    private suspend fun helloWithRetry(c: LinkClient): JsonObject {
        repeat(HELLO_ATTEMPTS) {
            try {
                return c.call("sys.hello", HELLO_ARGS, timeoutMs = 500)
            } catch (_: LinkTimeoutException) {
                // device still booting
            }
        }
        throw LinkTimeoutException("sys.hello")
    }

    private suspend fun heartbeat(c: LinkClient) {
        while (true) {
            delay(HEARTBEAT_MS)
            try {
                c.call("sys.ping")
            } catch (_: LinkTimeoutException) {
                log("heartbeat timeout")
            } catch (_: LinkClosedException) {
                return
            }
        }
    }

    /**
     * Opens the vault. Order: provision a fresh device, unlock with our Keystore token, or, after a
     * backup import, unlock once with the old phone's token and rotate to ours (link spec 6.10).
     */
    private suspend fun unlock(c: LinkClient, firstHello: JsonObject): Boolean = unlockMutex.withLock {
        val deviceId = firstHello.str("device_id")!!
        val deviceBytes = OgCrypto.unhex(deviceId)
        when (firstHello.str("state")) {
            "unlocked" -> return true
            "unprovisioned" -> {
                val name = settings.get(Settings.DISPLAY_NAME)?.takeIf(MessageLimits::isValidName)
                c.call("sec.provision", wrapArgs(firstHello, tokenSource.token(deviceBytes), deviceBytes, name))
                return true
            }
        }
        try {
            c.call("sec.unlock", wrapArgs(firstHello, tokenSource.token(deviceBytes), deviceBytes))
            return true
        } catch (e: LinkCommandException) {
            if (e.error.code != "E_UNLOCK_FAILED") throw e
        }
        val transfer = settings.get(Settings.TRANSFER_TOKEN)
        if (transfer == null || settings.get(Settings.TRANSFER_DEVICE) != deviceId) return false
        // The backup carries the old phone's token for exactly this device, not its Keystore key.
        c.call("sec.unlock", wrapArgs(c.call("sys.hello", HELLO_ARGS), OgCrypto.unb64(transfer), deviceBytes))
        c.call("sec.rotate_token", wrapArgs(c.call("sys.hello", HELLO_ARGS), tokenSource.token(deviceBytes), deviceBytes))
        settings.remove(Settings.TRANSFER_TOKEN)
        settings.remove(Settings.TRANSFER_DEVICE)
        return true
    }

    private fun wrapArgs(hello: JsonObject, token: ByteArray, deviceId: ByteArray, name: String? = null): JsonObject {
        val sessionInfo = hello.obj("session") ?: throw LinkCommandException("sys.hello", LinkError("E_NO_SESSION", null, null))
        val wrapped = TokenWrap.wrap(
            token = token,
            deviceId = deviceId,
            deviceEphPub = OgCrypto.unb64(sessionInfo.str("device_eph_pub")!!),
            nonce = OgCrypto.unb64(sessionInfo.str("nonce")!!),
        )
        return buildJsonObject {
            put("app_eph_pub", OgCrypto.b64(wrapped.appEphPub))
            put("wrapped_token", OgCrypto.b64(wrapped.wrapped))
            if (name != null) put("name", name)
        }
    }

    /** This phone's unlock token for a device, exported in a backup so a new phone can take over (spec 6.10). */
    fun tokenFor(deviceId: String): ByteArray = tokenSource.token(OgCrypto.unhex(deviceId))

    private suspend fun handleEvent(event: Incoming.Event) {
        when (event.name) {
            "sys.boot" -> if (state.value.ready) {
                // The device restarted under us: its queue is gone and it is locked again.
                listener.onDeviceRebooted()
                relock()
            }
            "sec.state" -> if (event.data.str("state") == "locked" && state.value.ready) relock()
            else -> listener.onEvent(event)
        }
    }

    private suspend fun relock() {
        val c = client ?: return
        try {
            val hello = c.call("sys.hello", HELLO_ARGS)
            if (!unlock(c, hello)) fail(AntennaError.UNLOCK_FAILED) else listener.onReady(this, hello.str("device_id")!!)
        } catch (e: Exception) {
            log("re-unlock failed: ${e.message}")
        }
    }

    private companion object {
        const val PROTO_MAJOR = "1"
        const val HELLO_ATTEMPTS = 10
        const val HEARTBEAT_MS = 5_000L
        val HELLO_ARGS = buildJsonObject { put("app", "offgrid-android"); put("app_proto", "1.0") }
    }
}
