package ch.offgrid.android.domain

import ch.offgrid.android.BuildConfig
import ch.offgrid.android.crypto.OgCrypto
import ch.offgrid.android.crypto.TokenWrap
import ch.offgrid.android.crypto.UnlockTokenSource
import ch.offgrid.android.crypto.WrapPurpose
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
import ch.offgrid.android.link.bool
import ch.offgrid.android.link.double
import ch.offgrid.android.link.int
import ch.offgrid.android.link.obj
import ch.offgrid.android.link.str
import kotlinx.coroutines.CompletableDeferred
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
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

enum class AntennaPhase { DISCONNECTED, SEARCHING, DEVICE_FOUND, CONNECTING, READY, ERROR }

/** UI error codes, texts in the screen spec ("Fehlertexte") and `AntennaError.text()`. */
enum class AntennaError {
    NO_DEVICE, PERMISSION_DENIED, OPEN_FAILED, NO_INFO, PROTO_MISMATCH, LOST,

    /** `E_UNLOCK_FAILED`: the antenna's vault belongs to another phone's token. */
    UNLOCK_FAILED,

    /** `E_RATE_LIMITED`: too many failed unlock or reset attempts, the antenna waits (2 s doubling, at most 60 s). */
    RATE_LIMITED,

    /** `E_NO_SESSION` twice in a row: the `sys.hello` session expired or was used up. */
    NO_SESSION,

    /** `E_INTERNAL` during unlock: the antenna could not read or write its vault. */
    VAULT_ERROR,

    /** Any other error code; [AntennaState.errorCode] has it. */
    REJECTED,
}

data class AntennaState(
    val phase: AntennaPhase = AntennaPhase.DISCONNECTED,
    val kind: LinkKind = LinkKind.SIMULATED,
    val deviceLabel: String? = null,
    val fwVersion: String? = null,
    val freqMhz: Double? = null,
    val deviceId: String? = null,
    val nodeId: String? = null,
    val maxTextBytes: Int = MessageLimits.DEFAULT_MAX_TEXT_BYTES,
    /** TEXT codec of a lab radio image (`sys.hello.text_codec`); the team firmware always sends raw UTF-8. */
    val textCodec: String = MessageLimits.CODEC_RAW,
    /** UTF-8 input the antenna accepts; above [maxTextBytes] only with a codec (`limits.max_text_input_bytes`). */
    val maxTextInputBytes: Int = MessageLimits.DEFAULT_MAX_TEXT_BYTES,
    val error: AntennaError? = null,
    /** The link error code behind [error], for the note on the connect screen. */
    val errorCode: String? = null,
    /** Reason of the last `sec.state` "locked" (`heartbeat_timeout`, `lock`, `error`, …) until the antenna is open again. */
    val lockReason: String? = null,
) {
    val ready: Boolean get() = phase == AntennaPhase.READY
    val busy: Boolean get() = phase == AntennaPhase.SEARCHING || phase == AntennaPhase.DEVICE_FOUND || phase == AntennaPhase.CONNECTING
}

/** Outcome of [AntennaManager.factoryReset]. */
enum class ResetResult { DONE, NOT_CONNECTED, WRONG_PHONE, RATE_LIMITED, UNSUPPORTED, FAILED }

/** Receives device events and the "ready" signal; implemented by [Messaging]. */
interface AntennaListener {
    suspend fun onReady(antenna: AntennaManager, deviceId: String)
    suspend fun onEvent(event: Incoming.Event)
    suspend fun onDeviceRebooted()
}

/** Opening the vault failed for a reason the user has to see. */
private class UnlockFailure(val error: AntennaError, val code: String?) : Exception(code ?: error.name)

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

    /** Set while a factory reset runs: its lock and restart are expected and must not trigger a re-unlock. */
    @Volatile
    private var resetBoot: CompletableDeferred<Unit>? = null

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
        _state.update { it.copy(phase = AntennaPhase.DISCONNECTED, error = null, errorCode = null) }
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
            hello.str("device_id") ?: return fail(AntennaError.NO_INFO)
            bringUp(c, hello)
            val heartbeat = scope.launch { heartbeat(c) }
            val cause = c.closed.await()
            heartbeat.cancel()
            // Somebody else may already have ended the session with a reason (a failed re-unlock); keep it.
            if (state.value.phase != AntennaPhase.ERROR) fail(if (cause != null) AntennaError.LOST else null)
        } catch (e: UnlockFailure) {
            log("unlock failed: ${e.code}")
            fail(e.error, e.code)
        } catch (_: LinkTimeoutException) {
            fail(AntennaError.NO_INFO)
        } catch (_: LinkClosedException) {
            fail(AntennaError.LOST)
        } catch (e: LinkCommandException) {
            log("session failed: ${e.error.code}")
            fail(if (e.error.code == "E_PROTO_MISMATCH") AntennaError.PROTO_MISMATCH else AntennaError.REJECTED, e.error.code)
        } finally {
            eventJob.cancel()
        }
    }

    /**
     * From a `sys.hello` answer to "ready": open the vault, apply the text codec, read radio and identity,
     * then tell the listener. Used on connect, after an auto-lock or restart, and after a factory reset.
     */
    private suspend fun bringUp(c: LinkClient, hello: JsonObject) {
        val deviceId = hello.str("device_id")!!
        val maxText = hello.obj("limits")?.int("max_text_bytes") ?: MessageLimits.DEFAULT_MAX_TEXT_BYTES
        val chip = hello.str("chip")?.substringBefore('-')
        _state.update {
            it.copy(deviceId = deviceId, maxTextBytes = maxText, fwVersion = hello.obj("fw")?.str("version"),
                deviceLabel = chip ?: it.deviceLabel, textCodec = hello.str("text_codec") ?: MessageLimits.CODEC_RAW,
                maxTextInputBytes = hello.obj("limits")?.int("max_text_input_bytes") ?: maxText)
        }
        unlock(c, hello)
        if (hello.bool("lab_radio") == true) selectTextCodec(c)
        val radio = c.call("radio.get")
        val identity = c.call("id.get")
        identity.str("public_key")?.let { settings.put(Settings.OWN_PUBLIC_KEY, it) }
        _state.update {
            it.copy(phase = AntennaPhase.READY, freqMhz = radio.double("freq_mhz"), nodeId = identity.str("node_id"),
                error = null, errorCode = null, lockReason = null)
        }
        listener.onReady(this, deviceId)
    }

    private fun fail(error: AntennaError?, code: String? = null) {
        client?.close()
        client = null
        _state.update {
            it.copy(phase = if (error == null) AntennaPhase.DISCONNECTED else AntennaPhase.ERROR, error = error, errorCode = code)
        }
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
     * Opens the vault (link spec 6.5 to 6.10). Each `sys.hello` session allows one attempt, so a state that
     * changed in between (`E_NO_SESSION`, `E_NOT_PROVISIONED`, `E_ALREADY_PROVISIONED`) gets one more try
     * with a fresh `sys.hello`; `E_ALREADY_UNLOCKED` means the vault is open. Throws [UnlockFailure].
     */
    private suspend fun unlock(c: LinkClient, firstHello: JsonObject) = unlockMutex.withLock {
        var hello = firstHello
        for (attempt in 1..2) {
            try {
                openVault(c, hello)
                return@withLock
            } catch (e: LinkCommandException) {
                val code = e.error.code
                if (code == "E_ALREADY_UNLOCKED") return@withLock
                if (attempt == 1 && code in RETRY_WITH_NEW_HELLO) {
                    hello = c.call("sys.hello", HELLO_ARGS)
                    continue
                }
                throw UnlockFailure(errorFor(code), code)
            }
        }
    }

    /**
     * Provision a fresh antenna, unlock with this phone's Keystore token, or, after a backup import,
     * unlock once with the old phone's token and rotate to ours (link spec 6.10).
     */
    private suspend fun openVault(c: LinkClient, hello: JsonObject) {
        val deviceId = hello.str("device_id")!!
        val deviceBytes = OgCrypto.unhex(deviceId)
        when (hello.str("state")) {
            "unlocked" -> return
            "unprovisioned" -> return provision(c, hello, deviceId, deviceBytes)
        }
        try {
            c.call("sec.unlock", wrapArgs(hello, tokenSource.token(deviceBytes), deviceBytes))
            return
        } catch (e: LinkCommandException) {
            if (e.error.code != "E_UNLOCK_FAILED") throw e
        }
        val transfer = transferTokenFor(deviceId) ?: throw UnlockFailure(AntennaError.UNLOCK_FAILED, "E_UNLOCK_FAILED")
        // The backup carries the old phone's token for exactly this device, not its Keystore key.
        c.call("sec.unlock", wrapArgs(c.call("sys.hello", HELLO_ARGS), transfer, deviceBytes))
        c.call("sec.rotate_token", wrapArgs(c.call("sys.hello", HELLO_ARGS), tokenSource.token(deviceBytes), deviceBytes))
        clearTransferToken()
    }

    /**
     * Sets up an antenna without a vault: a new board, a reflashed one or one after a factory reset.
     * The vault then only opens with this phone's token. The app never stores that token (it is derived
     * from the Keystore key and the device_id each time), but a token from a backup import for this
     * antenna can never open the new vault, so it goes. The contacts the antenna held are gone with the old
     * vault; [Messaging] marks them for pairing again when it syncs the contact list.
     */
    private suspend fun provision(c: LinkClient, hello: JsonObject, deviceId: String, deviceBytes: ByteArray) {
        val name = settings.get(Settings.DISPLAY_NAME)?.takeIf(MessageLimits::isValidName)
        c.call("sec.provision", wrapArgs(hello, tokenSource.token(deviceBytes), deviceBytes, name))
        if (settings.get(Settings.TRANSFER_DEVICE) == deviceId) clearTransferToken()
    }

    private suspend fun transferTokenFor(deviceId: String): ByteArray? {
        val transfer = settings.get(Settings.TRANSFER_TOKEN) ?: return null
        return if (settings.get(Settings.TRANSFER_DEVICE) == deviceId) OgCrypto.unb64(transfer) else null
    }

    private suspend fun clearTransferToken() {
        settings.remove(Settings.TRANSFER_TOKEN)
        settings.remove(Settings.TRANSFER_DEVICE)
    }

    /**
     * Applies the build's TEXT codec flag to a lab radio image (`lab.set`, persisted on the antenna). The
     * antenna compresses; the app only needs the codec to count what fits (see [MessageLimits.onAirTextBytes]).
     */
    private suspend fun selectTextCodec(c: LinkClient) {
        val wanted = BuildConfig.TEXT_CODEC
        if (wanted.isEmpty() || wanted == state.value.textCodec) return
        try {
            val result = c.call("lab.set", buildJsonObject { put("text_codec", wanted) })
            _state.update {
                it.copy(textCodec = result.str("text_codec") ?: it.textCodec,
                    maxTextInputBytes = result.int("max_text_input_bytes") ?: it.maxTextInputBytes)
            }
        } catch (e: LinkCommandException) {
            log("text codec $wanted not applied: ${e.error.code}")
        }
    }

    private fun wrapArgs(
        hello: JsonObject,
        token: ByteArray,
        deviceId: ByteArray,
        name: String? = null,
        purpose: WrapPurpose = WrapPurpose.UNLOCK,
    ): JsonObject {
        val sessionInfo = hello.obj("session") ?: throw LinkCommandException("sys.hello", LinkError("E_NO_SESSION", null, null))
        val wrapped = TokenWrap.wrap(
            token = token,
            deviceId = deviceId,
            deviceEphPub = OgCrypto.unb64(sessionInfo.str("device_eph_pub")!!),
            nonce = OgCrypto.unb64(sessionInfo.str("nonce")!!),
            purpose = purpose,
        )
        return buildJsonObject {
            put("app_eph_pub", OgCrypto.b64(wrapped.appEphPub))
            put("wrapped_token", OgCrypto.b64(wrapped.wrapped))
            if (name != null) put("name", name)
        }
    }

    /** This phone's unlock token for a device, exported in a backup so a new phone can take over (spec 6.10). */
    fun tokenFor(deviceId: String): ByteArray = tokenSource.token(OgCrypto.unhex(deviceId))

    /**
     * Erases the connected antenna (link spec 6.11, `method: "app"`): vault, identity, contacts and settings
     * go, the device_id stays. This phone proves it is the owner with its token wrapped under the reset
     * label; after a backup import the old phone's token is tried too. On success the antenna locks,
     * restarts unprovisioned, and this manager sets it up again for this phone in the background.
     */
    suspend fun factoryReset(): ResetResult {
        val c = client ?: return ResetResult.NOT_CONNECTED
        val deviceId = state.value.deviceId?.takeIf { state.value.ready } ?: return ResetResult.NOT_CONNECTED
        val deviceBytes = OgCrypto.unhex(deviceId)
        val tokens = listOfNotNull(tokenSource.token(deviceBytes), transferTokenFor(deviceId))
        val boot = CompletableDeferred<Unit>()
        resetBoot = boot
        try {
            for (token in tokens) {
                val args = buildJsonObject {
                    put("confirm", "ERASE")
                    put("method", "app")
                    wrapArgs(c.call("sys.hello", HELLO_ARGS), token, deviceBytes, purpose = WrapPurpose.RESET)
                        .forEach { (k, v) -> put(k, v) }
                }
                try {
                    c.call("sys.factory_reset", args)
                } catch (e: LinkCommandException) {
                    log("factory reset refused: ${e.error.code}")
                    when (e.error.code) {
                        "E_UNLOCK_FAILED" -> continue
                        "E_RATE_LIMITED" -> return ResetResult.RATE_LIMITED.also { resetBoot = null }
                        // Older images confirm the reset with the button instead (E_BUSY) or do not know it.
                        "E_BUSY", "E_UNKNOWN_CMD" -> return ResetResult.UNSUPPORTED.also { resetBoot = null }
                        else -> return ResetResult.FAILED.also { resetBoot = null }
                    }
                }
                clearTransferToken()
                _state.update { it.copy(phase = AntennaPhase.CONNECTING, lockReason = "factory_reset") }
                scope.launch { setUpAfterReset(c, boot) }
                return ResetResult.DONE
            }
            resetBoot = null
            return ResetResult.WRONG_PHONE
        } catch (_: LinkTimeoutException) {
            resetBoot = null
            return ResetResult.FAILED
        } catch (_: LinkClosedException) {
            resetBoot = null
            return ResetResult.NOT_CONNECTED
        }
    }

    /** Waits for the restart after a reset (`sys.boot`), then provisions the empty antenna again. */
    private suspend fun setUpAfterReset(c: LinkClient, boot: CompletableDeferred<Unit>) {
        try {
            // The serial port of the Heltec V3 stays open over the restart; without sys.boot, sys.hello retries decide.
            withTimeoutOrNull(RESET_BOOT_TIMEOUT_MS) { boot.await() }
            resetBoot = null
            bringUp(c, helloWithRetry(c))
        } catch (e: UnlockFailure) {
            fail(e.error, e.code)
        } catch (_: LinkTimeoutException) {
            fail(AntennaError.NO_INFO)
        } catch (_: LinkClosedException) {
            fail(AntennaError.LOST)
        } catch (e: LinkCommandException) {
            fail(AntennaError.REJECTED, e.error.code)
        } finally {
            resetBoot = null
        }
    }

    private suspend fun handleEvent(event: Incoming.Event) {
        val reset = resetBoot
        when (event.name) {
            "sys.boot" -> when {
                reset != null -> {
                    listener.onDeviceRebooted()
                    reset.complete(Unit)
                }
                state.value.ready -> {
                    // The device restarted under us: its queue is gone and it is locked again.
                    listener.onDeviceRebooted()
                    relock()
                }
            }
            "sec.state" -> if (event.data.str("state") == "locked") {
                _state.update { it.copy(lockReason = event.data.str("reason")) }
                if (reset == null && state.value.ready) relock()
            }
            else -> listener.onEvent(event)
        }
    }

    /** Opens the vault again after an auto-lock or restart; ends the session with the reason when that fails. */
    private suspend fun relock() {
        val c = client ?: return
        try {
            bringUp(c, c.call("sys.hello", HELLO_ARGS))
        } catch (e: UnlockFailure) {
            log("re-unlock failed: ${e.code}")
            fail(e.error, e.code)
        } catch (e: LinkCommandException) {
            log("re-unlock failed: ${e.error.code}")
            fail(AntennaError.REJECTED, e.error.code)
        } catch (_: LinkTimeoutException) {
            fail(AntennaError.NO_INFO)
        } catch (_: LinkClosedException) {
            // runSession reports the lost link
        }
    }

    private companion object {
        const val PROTO_MAJOR = "1"
        // 8 s: an image that plays its OLED boot animation in setup() answers only after it ends.
        const val HELLO_ATTEMPTS = 16
        const val HEARTBEAT_MS = 5_000L
        const val RESET_BOOT_TIMEOUT_MS = 15_000L
        val HELLO_ARGS = buildJsonObject { put("app", "offgrid-android"); put("app_proto", "1.0") }
        val RETRY_WITH_NEW_HELLO = setOf("E_NO_SESSION", "E_NOT_PROVISIONED", "E_ALREADY_PROVISIONED")

        fun errorFor(code: String): AntennaError = when (code) {
            "E_UNLOCK_FAILED" -> AntennaError.UNLOCK_FAILED
            "E_RATE_LIMITED" -> AntennaError.RATE_LIMITED
            "E_NO_SESSION" -> AntennaError.NO_SESSION
            "E_INTERNAL" -> AntennaError.VAULT_ERROR
            "E_PROTO_MISMATCH" -> AntennaError.PROTO_MISMATCH
            else -> AntennaError.REJECTED
        }
    }
}
