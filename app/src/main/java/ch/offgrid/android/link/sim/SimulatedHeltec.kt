package ch.offgrid.android.link.sim

import ch.offgrid.android.crypto.OgCrypto
import ch.offgrid.android.crypto.TokenWrap
import ch.offgrid.android.domain.MessageLimits
import ch.offgrid.android.link.FramedLine
import ch.offgrid.android.link.LineFramer
import ch.offgrid.android.link.LinkCodec
import ch.offgrid.android.link.Request
import ch.offgrid.android.link.bool
import ch.offgrid.android.link.double
import ch.offgrid.android.link.int
import ch.offgrid.android.link.obj
import ch.offgrid.android.link.str
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonObjectBuilder
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import java.util.concurrent.atomic.AtomicInteger

private class CommandError(val code: String, message: String, val field: String? = null) : Exception(message)

/**
 * In-process stand-in for the Heltec V3 firmware. It speaks the JSON Lines link protocol
 * byte-for-byte (requests in, responses and events out) and models the device states, the
 * vault unlock, pairing, the pending queue with ACKs and retries, and a few virtual peers.
 *
 * It does not model the radio bytes (AES-CCM, flooding); those belong to the firmware. Peers are
 * resolved logically, which is enough to exercise every app path without hardware.
 */
class SimulatedHeltec(
    private val store: SimFlashStore,
    private val scope: CoroutineScope,
    private val clock: () -> Long = System::currentTimeMillis,
) {
    private var flash: SimFlash = store.load() ?: SimFlash(deviceId = OgCrypto.hex(OgCrypto.randomBytes(6)))
        .also(store::save)

    private var state: String = if (flash.provisioned) "locked" else "unprovisioned"
    private var bootAt = clock()
    private var identityPrivate: ByteArray? = null
    private var session: Pair<ByteArray, ByteArray>? = null // device_eph_private, nonce
    private var pairing: Pair<ByteArray, Long>? = null // salt, expiry
    private var failedUnlocks = 0
    private var rateLimitedUntil = 0L
    private var lastActivity = clock()
    private val msgRef = AtomicInteger(0)
    private val pendingJobs = mutableMapOf<Int, Job>()
    private var output: Channel<ByteArray>? = null
    private val framer = LineFramer(dropFirstPartialLine = false)
    private var watchdog: Job? = null
    private val lock = Any()

    val deviceIdHex: String get() = flash.deviceId

    // ---------------------------------------------------------------- transport side

    /** Called when the app opens the port. The device sends an empty line and `sys.boot` (spec 3.3, 8). */
    fun attach(): Channel<ByteArray> = synchronized(lock) {
        output?.close()
        val channel = Channel<ByteArray>(Channel.UNLIMITED)
        output = channel
        channel.trySend("\n".toByteArray())
        emitEvent("sys.boot", bootData("power_on"))
        startWatchdog()
        channel
    }

    fun detach() = synchronized(lock) {
        output?.close()
        output = null
    }

    /** Simulates pulling the cable: the app sees the stream end with an error. */
    fun unplug() = synchronized(lock) {
        output?.close(java.io.IOException("USB device detached"))
        output = null
    }

    fun receive(bytes: ByteArray) {
        val lines = synchronized(lock) { framer.feed(bytes) }
        for (line in lines) {
            if (line !is FramedLine.Json) {
                if (line is FramedLine.TooLong) emitEvent("error", buildJsonObject {
                    put("code", "E_LINE_TOO_LONG"); put("message", "line exceeded 2048 bytes and was dropped")
                })
                continue
            }
            val request = LinkCodec.decodeRequest(line.text)
            if (request == null) {
                send(LinkCodec.encodeResponseError(null, "E_PARSE", "invalid JSON"))
                continue
            }
            synchronized(lock) { lastActivity = clock() }
            val reply = try {
                LinkCodec.encodeResponseOk(request.id, synchronized(lock) { execute(request) })
            } catch (e: CommandError) {
                LinkCodec.encodeResponseError(request.id, e.code, e.message ?: e.code, e.field)
            }
            send(reply)
            synchronized(lock) { afterResponse(request) }
        }
    }

    private fun send(bytes: ByteArray) {
        output?.trySend(bytes)
    }

    private fun uptime(): Long = clock() - bootAt

    private fun emitEvent(name: String, data: JsonObject) = send(LinkCodec.encodeEvent(name, uptime(), data))

    private fun startWatchdog() {
        if (watchdog?.isActive == true) return
        watchdog = scope.launch {
            while (isActive) {
                delay(1_000)
                synchronized(lock) {
                    val timeout = flash.lockTimeoutS
                    if (state == "unlocked" && timeout > 0 && clock() - lastActivity > timeout * 1_000L) {
                        lockVault("heartbeat_timeout")
                    }
                }
            }
        }
    }

    // ---------------------------------------------------------------- command dispatch

    private fun execute(r: Request): JsonObject {
        val a = r.args
        return when (r.cmd) {
            "sys.hello" -> hello()
            "sys.status" -> status()
            "sys.ping" -> buildJsonObject { put("uptime_ms", uptime()) }
            "sys.reboot" -> buildJsonObject { put("rebooting", true) }
            "sys.factory_reset" -> {
                if (a.str("confirm") != "ERASE") throw CommandError("E_CONFIRM_REQUIRED", "confirm must be ERASE", "confirm")
                buildJsonObject { put("armed", true); put("expires_s", 10); put("action", "hold PRG button for 3 s") }
            }
            "sys.set_log_level" -> buildJsonObject { put("level", a.str("level") ?: "info") }
            "sec.provision" -> provision(a)
            "sec.unlock" -> unlock(a)
            "sec.lock" -> { requireUnlocked(); lockVault("lock"); buildJsonObject { put("state", "locked") } }
            "sec.rotate_token" -> rotate(a)
            "sec.get_policy" -> { requireUnlocked(); buildJsonObject { put("lock_timeout_s", flash.lockTimeoutS) } }
            "sec.set_policy" -> {
                requireUnlocked()
                val t = a.int("lock_timeout_s") ?: throw CommandError("E_INVALID_ARG", "lock_timeout_s missing", "lock_timeout_s")
                if (t !in 0..3600) throw CommandError("E_INVALID_ARG", "lock_timeout_s out of range", "lock_timeout_s")
                save(flash.copy(lockTimeoutS = t))
                buildJsonObject { put("lock_timeout_s", t) }
            }
            "id.get" -> { requireUnlocked(); identity() }
            "id.set_name" -> {
                requireUnlocked()
                val name = validName(a.str("name"))
                save(flash.copy(name = name))
                identity()
            }
            "pair.begin" -> pairBegin()
            "pair.cancel" -> { requireUnlocked(); pairing = null; buildJsonObject { put("cancelled", true) } }
            "pair.complete" -> pairComplete(a)
            "contact.list" -> contactList(a)
            "contact.get" -> { requireUnlocked(); buildJsonObject { put("contact", contactJson(contact(a))) } }
            "contact.rename" -> {
                requireUnlocked()
                val c = contact(a)
                val name = validName(a.str("name"))
                updateContact(c.copy(name = name))
                buildJsonObject { put("contact", contactJson(c.copy(name = name))) }
            }
            "contact.delete" -> {
                requireUnlocked()
                val c = contact(a)
                if (a.bool("confirm") != true) throw CommandError("E_CONFIRM_REQUIRED", "confirm must be true", "confirm")
                save(flash.copy(contacts = flash.contacts.filter { it.contactId != c.contactId }))
                buildJsonObject { put("deleted", true) }
            }
            "msg.send" -> msgSend(a)
            "msg.cancel" -> {
                requireUnlocked()
                val ref = a.int("msg_ref") ?: throw CommandError("E_INVALID_ARG", "msg_ref missing", "msg_ref")
                pendingJobs.remove(ref)?.cancel()
                buildJsonObject { put("state", "cancelled") }
            }
            "msg.pending" -> { requireUnlocked(); buildJsonObject { putJsonArray("pending") {} } }
            "radio.get" -> radioJson()
            "radio.set" -> { requireUnlocked(); radioSet(a) }
            "radio.stats" -> { requireUnlocked(); buildJsonObject { put("tx_packets", msgRef.get()); put("rx_packets", 0) } }
            "mesh.get" -> buildJsonObject {
                put("hop_default", 3); put("relay_enabled", true); put("relay_when_locked", false)
                put("cad_enabled", true); put("retries", 3)
            }
            "led.get" -> buildJsonObject { put("enabled", true); put("brightness", 128) }
            "group.create" -> groupCreate(a)
            "group.send" -> groupSend(a)
            else -> throw CommandError("E_UNKNOWN_CMD", "unknown command ${r.cmd}", "cmd")
        }
    }

    /** Side effects that must happen after the response line (spec: response first, then events). */
    private fun afterResponse(r: Request) {
        when (r.cmd) {
            "sys.reboot" -> reboot("software")
        }
    }

    // ---------------------------------------------------------------- system and security

    private fun bootData(reason: String) = buildJsonObject {
        put("device_id", flash.deviceId); put("fw", FW_VERSION); put("proto", PROTO); put("state", state)
        put("reset_reason", reason)
    }

    private fun reboot(reason: String) {
        failAllPending("locked")
        state = if (flash.provisioned) "locked" else "unprovisioned"
        identityPrivate = null
        session = null
        bootAt = clock()
        emitEvent("sys.boot", bootData(reason))
    }

    private fun hello(): JsonObject {
        val ephPrivate = OgCrypto.x25519PrivateKey()
        val nonce = OgCrypto.randomBytes(16)
        session = ephPrivate to nonce
        return buildJsonObject {
            put("device", "heltec_wifi_lora_32_v3"); put("chip", "ESP32-S3"); put("device_id", flash.deviceId)
            putJsonObject("fw") { put("version", FW_VERSION); put("build", "simulator") }
            put("proto", PROTO); put("state", state)
            putJsonObject("session") {
                put("device_eph_pub", OgCrypto.b64(OgCrypto.x25519PublicKey(ephPrivate)))
                put("nonce", OgCrypto.b64(nonce))
            }
            putJsonObject("limits") {
                put("max_line", 2048); put("max_contacts", 32)
                put("max_text_bytes", MessageLimits.DEFAULT_MAX_TEXT_BYTES); put("pending_queue", 8)
            }
        }
    }

    private fun status() = buildJsonObject {
        put("state", state); put("uptime_ms", uptime()); put("reset_reason", "power_on")
        put("heap_free", 172304); put("battery_mv", JsonNull)
        putJsonObject("radio") { put("running", state == "unlocked"); put("relay_only", false) }
        if (state == "unlocked") {
            putJsonObject("queue") { put("pending", pendingJobs.size); put("capacity", 8) }
            putJsonObject("contacts") { put("used", flash.contacts.size); put("capacity", 32) }
        }
        putJsonObject("security") { put("secure_boot", false); put("flash_encryption", false) }
    }

    /** Consumes the `sys.hello` session and returns the unwrapped token (spec 6.7: single use). */
    private fun consumeToken(a: JsonObject): ByteArray {
        val (ephPrivate, nonce) = session ?: throw CommandError("E_NO_SESSION", "call sys.hello first")
        session = null
        val appPub = a.str("app_eph_pub") ?: throw CommandError("E_INVALID_ARG", "app_eph_pub missing", "app_eph_pub")
        val wrapped = a.str("wrapped_token") ?: throw CommandError("E_INVALID_ARG", "wrapped_token missing", "wrapped_token")
        return try {
            TokenWrap.unwrap(OgCrypto.unb64(wrapped), OgCrypto.unhex(flash.deviceId), ephPrivate, OgCrypto.unb64(appPub), nonce)
        } catch (_: Exception) {
            throw CommandError("E_UNLOCK_FAILED", "unlock failed")
        }
    }

    private fun vaultCheck(token: ByteArray, salt: ByteArray): String =
        OgCrypto.b64(OgCrypto.sha256(OgCrypto.hkdfSha256(token, salt, "og-vault-v1".toByteArray(), 32)))

    private fun provision(a: JsonObject): JsonObject {
        if (state != "unprovisioned") throw CommandError("E_ALREADY_PROVISIONED", "device already has a vault")
        val token = consumeToken(a)
        val name = a.str("name")?.let { validName(it) } ?: "Offgrid-${flash.deviceId.takeLast(4)}"
        val salt = OgCrypto.randomBytes(16)
        val identity = OgCrypto.x25519PrivateKey()
        save(flash.copy(provisioned = true, vaultSalt = OgCrypto.b64(salt), vaultCheck = vaultCheck(token, salt),
            identityPrivate = OgCrypto.b64(identity), name = name))
        identityPrivate = identity
        state = "unlocked"
        emitLater("sec.state", buildJsonObject { put("state", "unlocked"); put("reason", "provision") })
        return identity().let { id -> buildJsonObject { id.forEach { (k, v) -> put(k, v) }; put("state", state) } }
    }

    private fun unlock(a: JsonObject): JsonObject {
        when (state) {
            "unprovisioned" -> throw CommandError("E_NOT_PROVISIONED", "device has no vault")
            "unlocked" -> throw CommandError("E_ALREADY_UNLOCKED", "already unlocked")
        }
        if (clock() < rateLimitedUntil) throw CommandError("E_RATE_LIMITED", "too many failed unlocks")
        val token = try {
            consumeToken(a)
        } catch (e: CommandError) {
            if (e.code == "E_UNLOCK_FAILED") registerFailure()
            throw e
        }
        if (vaultCheck(token, OgCrypto.unb64(flash.vaultSalt!!)) != flash.vaultCheck) {
            registerFailure()
            throw CommandError("E_UNLOCK_FAILED", "unlock failed")
        }
        failedUnlocks = 0
        identityPrivate = OgCrypto.unb64(flash.identityPrivate!!)
        state = "unlocked"
        lastActivity = clock()
        emitLater("sec.state", buildJsonObject { put("state", "unlocked"); put("reason", "unlock") })
        return buildJsonObject {
            put("state", state); put("node_id", nodeId()); put("name", flash.name); put("contacts", flash.contacts.size)
            putJsonObject("radio") { put("running", true); put("relay_only", false) }
        }
    }

    private fun registerFailure() {
        failedUnlocks++
        if (failedUnlocks >= 3) {
            val backoff = (2_000L shl (failedUnlocks - 3)).coerceAtMost(60_000L)
            rateLimitedUntil = clock() + backoff
        }
    }

    private fun rotate(a: JsonObject): JsonObject {
        requireUnlocked()
        val token = consumeToken(a)
        val salt = OgCrypto.randomBytes(16)
        save(flash.copy(vaultSalt = OgCrypto.b64(salt), vaultCheck = vaultCheck(token, salt)))
        return buildJsonObject { put("rotated", true) }
    }

    private fun lockVault(reason: String) {
        if (state != "unlocked") return
        failAllPending("locked")
        identityPrivate = null
        state = "locked"
        emitEvent("sec.state", buildJsonObject { put("state", "locked"); put("reason", reason) })
    }

    private fun requireUnlocked() {
        when (state) {
            "unprovisioned" -> throw CommandError("E_NOT_PROVISIONED", "device has no vault")
            "locked" -> throw CommandError("E_LOCKED", "device is locked, call sec.unlock")
        }
    }

    private fun publicKey(): ByteArray = OgCrypto.x25519PublicKey(identityPrivate!!)
    private fun nodeId(): String = OgCrypto.nodeId(publicKey())

    private fun identity() = buildJsonObject {
        put("node_id", nodeId()); put("public_key", OgCrypto.b64(publicKey())); put("name", flash.name)
    }

    private fun validName(name: String?): String {
        val n = name?.trim() ?: throw CommandError("E_INVALID_ARG", "name missing", "name")
        if (n.isEmpty() || MessageLimits.utf8Bytes(n) > MessageLimits.MAX_NAME_BYTES) {
            throw CommandError("E_INVALID_ARG", "name must be 1 to 24 bytes", "name")
        }
        return n
    }

    // ---------------------------------------------------------------- pairing and contacts

    private fun pairBegin(): JsonObject {
        requireUnlocked()
        val salt = OgCrypto.randomBytes(16)
        pairing = salt to clock() + 300_000
        val payload = "OG1".toByteArray() + publicKey() + salt + (flash.name ?: "").toByteArray()
        return buildJsonObject { put("qr", OgCrypto.b64(payload)); put("qr_bytes", payload.size); put("expires_s", 300) }
    }

    private fun pairComplete(a: JsonObject): JsonObject {
        requireUnlocked()
        val (_, expiry) = pairing ?: throw CommandError("E_NO_PAIRING", "call pair.begin first")
        if (clock() > expiry) throw CommandError("E_NO_PAIRING", "pairing expired")
        val qr = a.str("qr") ?: throw CommandError("E_INVALID_ARG", "qr missing", "qr")
        val parsed = parseQr(qr) ?: throw CommandError("E_INVALID_QR", "bad QR payload", "qr")
        val (peerPub, _, qrName) = parsed
        if (peerPub.contentEquals(publicKey())) throw CommandError("E_SELF_PAIR", "QR contains my own key")
        val pubB64 = OgCrypto.b64(peerPub)
        val existing = flash.contacts.firstOrNull { it.publicKey == pubB64 }
        if (existing != null && a.bool("replace") != true) throw CommandError("E_CONTACT_EXISTS", "already paired")
        if (existing == null && flash.contacts.size >= 32) throw CommandError("E_STORAGE_FULL", "no free contact slot")
        val name = a.str("name")?.let(::validName) ?: qrName.ifBlank { "Offgrid-${OgCrypto.nodeId(peerPub)}" }
        val id = existing?.contactId ?: ((1..32).first { slot -> flash.contacts.none { it.contactId == slot } })
        val peer = flash.peers.firstOrNull { it.publicKey == pubB64 }
        val contact = SimContact(
            contactId = id, name = name, nodeId = OgCrypto.nodeId(peerPub), publicKey = pubB64, state = "pending",
            fingerprint = OgCrypto.fingerprint(publicKey(), peerPub),
        )
        save(flash.copy(contacts = flash.contacts.filter { it.contactId != id } + contact))
        val warnings = if (flash.contacts.count { it.nodeId == contact.nodeId } > 1) listOf("node_id_collision") else emptyList()
        if (peer != null && peer.scansBack && peer.inRange) {
            // The peer scans our code too and its app pings us; the first valid packet activates the contact.
            scope.launch {
                delay(1_500)
                synchronized(lock) { peerPacket(peer, id) }
            }
        }
        return buildJsonObject {
            put("contact", contactJson(contact))
            putJsonArray("warnings") { warnings.forEach { add(JsonPrimitive(it)) } }
        }
    }

    /** QR text = Base64("OG1" || public_key(32) || salt(16) || name). */
    private fun parseQr(qr: String): Triple<ByteArray, ByteArray, String>? {
        val raw = runCatching { OgCrypto.unb64(qr.trim()) }.getOrNull() ?: return null
        if (raw.size < 51 || raw[0] != 'O'.code.toByte() || raw[1] != 'G'.code.toByte() || raw[2] != '1'.code.toByte()) return null
        return Triple(raw.copyOfRange(3, 35), raw.copyOfRange(35, 51), raw.copyOfRange(51, raw.size).toString(Charsets.UTF_8))
    }

    private fun contactList(a: JsonObject): JsonObject {
        requireUnlocked()
        val offset = a.int("offset") ?: 0
        val limit = (a.int("limit") ?: 10).coerceIn(1, 10)
        val sorted = flash.contacts.sortedBy { it.contactId }
        return buildJsonObject {
            put("total", sorted.size); put("offset", offset)
            putJsonArray("contacts") { sorted.drop(offset).take(limit).forEach { add(contactJson(it)) } }
        }
    }

    private fun contact(a: JsonObject): SimContact {
        val id = a.int("contact_id") ?: throw CommandError("E_INVALID_ARG", "contact_id missing", "contact_id")
        return flash.contacts.firstOrNull { it.contactId == id } ?: throw CommandError("E_NO_SUCH_CONTACT", "no contact $id")
    }

    private fun updateContact(c: SimContact) {
        save(flash.copy(contacts = flash.contacts.map { if (it.contactId == c.contactId) c else it }))
    }

    private fun contactJson(c: SimContact) = buildJsonObject {
        put("contact_id", c.contactId); put("name", c.name); put("node_id", c.nodeId); put("public_key", c.publicKey)
        put("state", c.state); put("fingerprint", c.fingerprint); put("tx_ctr", c.txCtr)
        put("rx_highest_ctr", c.rxHighestCtr); put("last_rssi", c.lastRssi); put("last_snr", c.lastSnr)
    }

    // ---------------------------------------------------------------- messages

    private fun msgSend(a: JsonObject): JsonObject {
        requireUnlocked()
        val to = a.int("to") ?: throw CommandError("E_INVALID_ARG", "to missing", "to")
        val c = flash.contacts.firstOrNull { it.contactId == to } ?: throw CommandError("E_NO_SUCH_CONTACT", "no contact $to")
        val type = a.str("type") ?: throw CommandError("E_INVALID_ARG", "type missing", "type")
        val bodyBytes = when (type) {
            "text" -> {
                val text = a.str("text") ?: throw CommandError("E_INVALID_ARG", "text missing", "text")
                val n = MessageLimits.utf8Bytes(text)
                if (n == 0) throw CommandError("E_INVALID_ARG", "text is empty", "text")
                if (n > MessageLimits.DEFAULT_MAX_TEXT_BYTES) {
                    throw CommandError("E_TOO_LONG", "text is $n bytes, max is ${MessageLimits.DEFAULT_MAX_TEXT_BYTES}", "text")
                }
                n
            }
            "reaction" -> {
                if (a.obj("target") == null) throw CommandError("E_INVALID_ARG", "target missing", "target")
                if (!a.containsKey("emoji")) throw CommandError("E_INVALID_ARG", "emoji missing", "emoji")
                3
            }
            "geo" -> {
                val lat = a.double("lat") ?: throw CommandError("E_INVALID_ARG", "lat missing", "lat")
                val lon = a.double("lon") ?: throw CommandError("E_INVALID_ARG", "lon missing", "lon")
                if (lat !in -90.0..90.0) throw CommandError("E_INVALID_ARG", "lat out of range", "lat")
                if (lon !in -180.0..180.0) throw CommandError("E_INVALID_ARG", "lon out of range", "lon")
                6
            }
            else -> throw CommandError("E_INVALID_ARG", "unknown type", "type")
        }
        if (pendingJobs.size >= 8) throw CommandError("E_QUEUE_FULL", "pending queue is full")
        val ack = a.bool("ack") ?: (type == "text")
        val hops = a.int("hops") ?: 3
        val ref = msgRef.incrementAndGet()
        val ctr = c.txCtr + 1
        updateContact(c.copy(txCtr = ctr))
        val onAir = 17 + bodyBytes
        pendingJobs[ref] = scope.launch { deliver(ref, c.contactId, ack, a, type) }
        return buildJsonObject {
            put("msg_ref", ref); put("ctr", ctr); put("ack_requested", ack); put("hops", hops); put("state", "queued")
            put("bytes_on_air", onAir); put("est_airtime_ms", 120 + onAir * 4)
        }
    }

    private fun status(ref: Int, to: Int, state: String, retry: Int, extra: JsonObjectBuilder.() -> Unit = {}) =
        emitEvent("msg.status", buildJsonObject {
            put("msg_ref", ref); put("to", to); put("state", state); put("retry", retry); extra()
        })

    private suspend fun deliver(ref: Int, to: Int, ack: Boolean, args: JsonObject, type: String) {
        delay(350)
        val peer = synchronized(lock) { peerFor(to) }
        synchronized(lock) { status(ref, to, "sent", 0) }
        if (!ack) {
            synchronized(lock) { pendingJobs.remove(ref) }
            if (peer != null && peer.inRange) reactTo(peer, to, args, type)
            return
        }
        for (retry in 0..3) {
            if (retry > 0) synchronized(lock) { status(ref, to, "retrying", retry) }
            delay(if (retry == 0) 900 else 2_000)
            val reachable = synchronized(lock) {
                val p = peerFor(to)
                p != null && p.inRange && p.scansBack && state == "unlocked"
            }
            if (reachable) {
                synchronized(lock) {
                    status(ref, to, "delivered", retry) { put("hops", 1); put("rtt_ms", 842) }
                    pendingJobs.remove(ref)
                    activate(to, peer!!)
                }
                reactTo(peer!!, to, args, type)
                return
            }
        }
        synchronized(lock) {
            status(ref, to, "failed", 3) { put("reason", "timeout") }
            pendingJobs.remove(ref)
        }
    }

    /** Virtual peers answer questions and share their position back. */
    private suspend fun reactTo(peer: VirtualPeer, contactId: Int, args: JsonObject, type: String) {
        when {
            type == "geo" && peer.lat != null && peer.lon != null -> {
                delay(2_500)
                synchronized(lock) {
                    incoming(peer, contactId, buildJsonObject {
                        put("type", "geo"); put("lat", peer.lat); put("lon", peer.lon); put("alt_m", JsonNull); put("age_s", 10)
                    })
                }
            }
            type == "text" && peer.replies.isNotEmpty() && args.str("text")?.contains('?') == true -> {
                delay(3_000)
                synchronized(lock) {
                    val c = flash.contacts.firstOrNull { it.contactId == contactId } ?: return
                    val text = peer.replies[(c.rxHighestCtr ?: 0) % peer.replies.size]
                    incoming(peer, contactId, buildJsonObject { put("type", "text"); put("text", text) })
                }
            }
        }
    }

    /** A valid packet from [peer] arrived: deliver it to the app and activate the contact. */
    private fun incoming(peer: VirtualPeer, contactId: Int, body: JsonObject, group: Int? = null) {
        if (state != "unlocked") return
        val c = flash.contacts.firstOrNull { it.contactId == contactId } ?: return
        val ctr = (c.rxHighestCtr ?: 0) + 1
        updateContact(c.copy(rxHighestCtr = ctr, lastRssi = peer.rssi, lastSnr = peer.snr))
        emitEvent("msg.received", buildJsonObject {
            put("from", contactId)
            if (group != null) put("group", group)
            body.forEach { (k, v) -> put(k, v) }
            put("ctr", ctr); put("hops", 1); put("retry", 0); put("rssi", peer.rssi); put("snr", peer.snr)
        })
        activate(contactId, peer)
    }

    /** First packet from the peer after it scanned our code: an empty "remove reaction" ping. */
    private fun peerPacket(peer: VirtualPeer, contactId: Int) {
        incoming(peer, contactId, buildJsonObject {
            put("type", "reaction")
            putJsonObject("target") { put("author", "me"); put("ref", 0) }
            put("emoji", JsonNull)
        })
    }

    private fun activate(contactId: Int, peer: VirtualPeer) {
        val c = flash.contacts.firstOrNull { it.contactId == contactId } ?: return
        if (c.state == "active") return
        updateContact(c.copy(state = "active", lastRssi = peer.rssi, lastSnr = peer.snr))
        emitEvent("contact.state", buildJsonObject { put("contact_id", contactId); put("state", "active") })
    }

    private fun peerFor(contactId: Int): VirtualPeer? {
        val c = flash.contacts.firstOrNull { it.contactId == contactId } ?: return null
        return flash.peers.firstOrNull { it.publicKey == c.publicKey }
    }

    private fun failAllPending(reason: String) {
        pendingJobs.forEach { (ref, job) ->
            job.cancel()
            emitEvent("msg.status", buildJsonObject {
                put("msg_ref", ref); put("to", JsonNull); put("state", "failed"); put("retry", 0); put("reason", reason)
            })
        }
        pendingJobs.clear()
    }

    // ---------------------------------------------------------------- radio

    private fun radioJson() = buildJsonObject {
        put("freq_mhz", flash.freqMhz); put("bw_khz", flash.bwKhz); put("sf", flash.sf); put("cr", 5)
        put("tx_power_dbm", flash.txPowerDbm); put("preamble", 8); put("sync_word", 79)
        put("est_airtime_ms_23b", 206); put("max_text_bytes", MessageLimits.DEFAULT_MAX_TEXT_BYTES)
    }

    private fun radioSet(a: JsonObject): JsonObject {
        val freq = a.double("freq_mhz") ?: flash.freqMhz
        if (freq !in 150.0..960.0) throw CommandError("E_INVALID_ARG", "freq_mhz out of range", "freq_mhz")
        val sf = a.int("sf") ?: flash.sf
        if (sf !in 5..12) throw CommandError("E_INVALID_ARG", "sf out of range", "sf")
        save(flash.copy(freqMhz = freq, sf = sf, txPowerDbm = a.int("tx_power_dbm") ?: flash.txPowerDbm))
        return buildJsonObject {
            radioJson().forEach { (k, v) -> put(k, v) }
            putJsonArray("warnings") { if (freq !in 863.0..870.0) add(JsonPrimitive("outside_eu868")) }
        }
    }

    // ---------------------------------------------------------------- groups (proposed link 1.1 extension)

    private fun groupCreate(a: JsonObject): JsonObject {
        requireUnlocked()
        val name = a.str("name")?.trim().orEmpty()
        if (name.isEmpty() || MessageLimits.utf8Bytes(name) > MessageLimits.MAX_NAME_BYTES) {
            throw CommandError("E_INVALID_ARG", "name must be 1 to 24 bytes", "name")
        }
        val members = (a["members"] as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.content?.toIntOrNull() }
            ?: throw CommandError("E_INVALID_ARG", "members missing", "members")
        if (members.isEmpty() || members.size > MessageLimits.MAX_GROUP_MEMBERS) {
            throw CommandError("E_INVALID_ARG", "1 to 8 members", "members")
        }
        members.forEach { id ->
            val c = flash.contacts.firstOrNull { it.contactId == id } ?: throw CommandError("E_NO_SUCH_CONTACT", "no contact $id")
            if (c.state != "active") throw CommandError("E_INVALID_ARG", "contact $id is pending", "members")
        }
        val id = (flash.groups.maxOfOrNull { it.groupId } ?: 0) + 1
        save(flash.copy(groups = flash.groups + SimGroup(id, name, members)))
        return buildJsonObject {
            put("group_id", id); put("name", name)
            putJsonArray("members") { members.forEach { add(JsonPrimitive(it)) } }
        }
    }

    private fun groupSend(a: JsonObject): JsonObject {
        requireUnlocked()
        val gid = a.int("group_id") ?: throw CommandError("E_INVALID_ARG", "group_id missing", "group_id")
        val group = flash.groups.firstOrNull { it.groupId == gid } ?: throw CommandError("E_INVALID_ARG", "no group $gid", "group_id")
        val text = a.str("text") ?: throw CommandError("E_INVALID_ARG", "text missing", "text")
        val n = MessageLimits.utf8Bytes(text)
        if (n == 0 || n > MessageLimits.DEFAULT_MAX_TEXT_BYTES) throw CommandError("E_TOO_LONG", "text is $n bytes", "text")
        val ref = msgRef.incrementAndGet()
        pendingJobs[ref] = scope.launch {
            delay(400)
            synchronized(lock) {
                status(ref, 0, "sent", 0) { put("group", gid) }
                pendingJobs.remove(ref)
            }
            if (text.contains('?')) {
                val replier = synchronized(lock) {
                    group.members.firstNotNullOfOrNull { id -> peerFor(id)?.takeIf { it.inRange }?.let { id to it } }
                }
                if (replier != null) {
                    delay(3_000)
                    synchronized(lock) {
                        incoming(replier.second, replier.first, buildJsonObject {
                            put("type", "text"); put("text", replier.second.replies.firstOrNull() ?: "Ok")
                        }, group = gid)
                    }
                }
            }
        }
        return buildJsonObject { put("msg_ref", ref); put("ack_requested", false); put("state", "queued") }
    }

    // ---------------------------------------------------------------- test harness API (not part of the protocol)

    /** Creates a virtual peer and returns the QR text its app would show. */
    fun addVirtualPeer(
        name: String,
        rssi: Int,
        scansBack: Boolean = true,
        inRange: Boolean = true,
        replies: List<String> = emptyList(),
        lat: Double? = null,
        lon: Double? = null,
    ): String = synchronized(lock) {
        val private = OgCrypto.x25519PrivateKey()
        val public = OgCrypto.x25519PublicKey(private)
        val salt = OgCrypto.randomBytes(16)
        val peer = VirtualPeer(OgCrypto.b64(public), OgCrypto.b64(private), OgCrypto.b64(salt), name, rssi,
            snr = if (rssi > -100) 7.5 else 2.0, scansBack = scansBack, inRange = inRange, replies = replies, lat = lat, lon = lon)
        save(flash.copy(peers = flash.peers + peer))
        OgCrypto.b64("OG1".toByteArray() + public + salt + name.toByteArray())
    }

    /** Lets a virtual peer send a text right now (used by the demo seed and tests). */
    fun peerSays(contactId: Int, text: String) = synchronized(lock) {
        val peer = peerFor(contactId) ?: return@synchronized
        incoming(peer, contactId, buildJsonObject { put("type", "text"); put("text", text) })
    }

    fun setPeerInRange(contactId: Int, inRange: Boolean) = synchronized(lock) {
        val c = flash.contacts.firstOrNull { it.contactId == contactId } ?: return@synchronized
        save(flash.copy(peers = flash.peers.map { if (it.publicKey == c.publicKey) it.copy(inRange = inRange) else it }))
    }

    /** Factory reset without the button dance, for the "Alle Daten löschen" demo path. */
    fun wipe() = synchronized(lock) {
        failAllPending("locked")
        store.wipe()
        flash = SimFlash(deviceId = flash.deviceId).also(store::save)
        state = "unprovisioned"
        identityPrivate = null
        emitEvent("sys.boot", bootData("factory_reset"))
    }

    private fun emitLater(name: String, data: JsonObject) {
        scope.launch {
            delay(20)
            synchronized(lock) { emitEvent(name, data) }
        }
    }

    private fun save(newFlash: SimFlash) {
        flash = newFlash
        store.save(newFlash)
    }

    companion object {
        const val FW_VERSION = "0.1.0-sim"
        const val PROTO = "1.0"
    }
}
