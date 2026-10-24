package ch.offgrid.android.link

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.ReceiveChannel
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.JsonObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

class LinkCommandException(val cmd: String, val error: LinkError) : Exception("$cmd failed: ${error.code}")
class LinkTimeoutException(val cmd: String) : Exception("$cmd timed out")
class LinkClosedException(cause: Throwable? = null) : Exception("link closed", cause)

/**
 * Request/response client for the JSON Lines link protocol on top of an open [LinkSession].
 *
 * - Request ids are chosen here and matched against responses (spec 4.1/4.2).
 * - At most 4 requests are in flight (spec 4.4).
 * - Timeouts: 2 s for normal commands, 5 s for vault commands (spec 4.4).
 * - Events are delivered through [events] in arrival order. The consumer must not call [call] from
 *   inside the reader, which is why events go through a channel instead of a callback.
 */
class LinkClient(
    private val session: LinkSession,
    scope: CoroutineScope,
    private val log: (String) -> Unit = {},
) {
    private val framer = LineFramer()
    private val nextId = AtomicLong(1)
    private val pending = ConcurrentHashMap<Long, CompletableDeferred<Incoming.Response>>()
    private val inFlight = Semaphore(MAX_IN_FLIGHT)
    private val writeLock = Mutex()
    private val eventChannel = Channel<Incoming.Event>(Channel.UNLIMITED)
    private val closedSignal = CompletableDeferred<Throwable?>()

    val events: ReceiveChannel<Incoming.Event> get() = eventChannel

    /** Completes when the session ends; the value is the failure cause or null for a clean close. */
    val closed: Deferred<Throwable?> get() = closedSignal

    init {
        scope.launch {
            try {
                session.incoming.collect { chunk -> framer.feed(chunk).forEach(::handle) }
                finish(null)
            } catch (e: Exception) {
                finish(e)
            }
        }
    }

    private fun handle(line: FramedLine) {
        when (line) {
            is FramedLine.Noise -> log("noise: ${line.text.take(80)}")
            FramedLine.TooLong -> log("dropped line longer than $MAX_LINE_BYTES bytes")
            is FramedLine.Json -> when (val msg = LinkCodec.decodeIncoming(line.text)) {
                null -> log("unparsable line: ${line.text.take(80)}")
                is Incoming.Event -> eventChannel.trySend(msg)
                is Incoming.Response -> {
                    val waiter = msg.id?.let { pending[it] }
                    if (waiter != null) waiter.complete(msg) else log("response without request: ${msg.error?.code}")
                }
            }
        }
    }

    private fun finish(cause: Throwable?) {
        if (closedSignal.isCompleted) return
        closedSignal.complete(cause)
        // Close normally: consumers iterate `events` and must simply stop on unplug. The reason
        // is reported through [closed]; closing with a cause would throw inside every consumer.
        eventChannel.close()
        pending.values.forEach { it.completeExceptionally(LinkClosedException(cause)) }
    }

    /** Sends a command and returns its `result`. Throws [LinkCommandException], [LinkTimeoutException] or [LinkClosedException]. */
    suspend fun call(cmd: String, args: JsonObject? = null, timeoutMs: Long = timeoutFor(cmd)): JsonObject =
        inFlight.withPermit {
            if (closedSignal.isCompleted) throw LinkClosedException(closedSignal.getCompleted())
            val id = nextId.getAndIncrement()
            val waiter = CompletableDeferred<Incoming.Response>()
            pending[id] = waiter
            try {
                writeLock.withLock { session.write(LinkCodec.encodeRequest(id, cmd, args)) }
                val response = withTimeoutOrNull(timeoutMs) { waiter.await() } ?: throw LinkTimeoutException(cmd)
                if (!response.ok) throw LinkCommandException(cmd, response.error ?: LinkError("E_INTERNAL", null, null))
                response.result
            } finally {
                pending.remove(id)
            }
        }

    fun close() {
        session.close()
        finish(null)
    }

    companion object {
        const val MAX_IN_FLIGHT = 4
        private val VAULT_COMMANDS = setOf("pair.complete", "contact.delete")

        fun timeoutFor(cmd: String): Long =
            if (cmd.startsWith("sec.") || cmd in VAULT_COMMANDS) 5_000 else 2_000
    }
}
