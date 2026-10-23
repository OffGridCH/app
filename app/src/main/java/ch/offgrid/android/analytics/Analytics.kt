package ch.offgrid.android.analytics

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant

/**
 * The closed list of product events. No event takes free-form data, so contents, contacts, keys,
 * locations or IDs cannot end up in one by accident: the only parameter is a [Screen] from a fixed
 * enum of route patterns. Same events and privacy rules as the team app's PostHog concept.
 */
sealed interface AnalyticsEvent {
    val name: String

    data object AppOpened : AnalyticsEvent {
        override val name = "app_opened"
    }

    data class ScreenViewed(val screen: Screen) : AnalyticsEvent {
        override val name = "screen_viewed"
    }

    data object PairingStarted : AnalyticsEvent {
        override val name = "pairing_started"
    }

    data object PairingCompleted : AnalyticsEvent {
        override val name = "pairing_completed"
    }

    /** Counts sent messages; type, length, recipient and content stay on the phone. */
    data object MessageSent : AnalyticsEvent {
        override val name = "message_sent"
    }
}

/** Screens by route pattern, written like the team app (`chat/:contactId`), never with real IDs. */
enum class Screen(val pattern: String) {
    CONNECT("verbinden"),
    NAME("name"),
    CONTACTS("kontakte"),
    ADD_CONTACT("kontakte/neu"),
    CONTACT_ADDED("kontakte/neu/fertig/:contactId"),
    CHAT("chat/:contactId"),
    LOCATION("chat/:contactId/standort/:messageId"),
    SETTINGS("einstellungen"),
    EXPORT("einstellungen/export"),
    IMPORT("einstellungen/import"),
    NEW_GROUP("gruppe/neu"),
    GROUP("gruppe/:groupId"),
    ;

    companion object {
        private val placeholder = Regex("\\{(\\w+)\\}")

        /** Maps a Navigation route pattern such as `chat/{contactId}` or `kontakte/neu?tab={tab}`. */
        fun fromRoute(route: String?): Screen? {
            val pattern = route?.substringBefore('?')?.replace(placeholder, ":$1") ?: return null
            return entries.firstOrNull { it.pattern == pattern }
        }
    }
}

/** Sends one `/batch/` body; returns true on a 2xx answer. Replaced by a fake in unit tests. */
fun interface BatchSender {
    fun send(url: String, body: String): Boolean
}

/** Plain HTTPS POST without cookies or extra headers beyond the content type. */
object HttpBatchSender : BatchSender {
    override fun send(url: String, body: String): Boolean {
        val connection = URL(url).openConnection() as HttpURLConnection
        return try {
            connection.requestMethod = "POST"
            connection.connectTimeout = TIMEOUT_MS
            connection.readTimeout = TIMEOUT_MS
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.outputStream.use { it.write(body.toByteArray()) }
            connection.responseCode in 200..299
        } catch (_: java.io.IOException) {
            false
        } finally {
            connection.disconnect()
        }
    }

    private const val TIMEOUT_MS = 10_000
}

/**
 * Lean PostHog client against the EU `/batch/` endpoint instead of the posthog-android SDK. The SDK
 * attaches device, OS, app and network properties to every event and brings lifecycle autocapture,
 * session replay, feature flags and person processing that would all have to be switched off and
 * kept off across updates; this client can only send what [properties] builds.
 *
 * Without a project key it is a no-op: nothing is queued and nothing touches the network. Events
 * wait in memory (at most [MAX_QUEUE]) and go out [flushDelayMs] after the last one; a failed
 * request keeps them for the next try.
 */
class Analytics(
    private val apiKey: String,
    private val scope: CoroutineScope,
    private val distinctId: () -> String,
    private val sender: BatchSender = HttpBatchSender,
    private val host: String = EU_HOST,
    private val flushDelayMs: Long = FLUSH_DELAY_MS,
    private val clock: () -> Long = System::currentTimeMillis,
) {
    val enabled: Boolean = apiKey.isNotBlank()

    private data class Queued(val event: AnalyticsEvent, val at: Long)

    private val queue = ArrayDeque<Queued>()
    private val flushMutex = Mutex()
    private var flushJob: Job? = null

    fun track(event: AnalyticsEvent) {
        if (!enabled) return
        synchronized(queue) {
            queue.addLast(Queued(event, clock()))
            while (queue.size > MAX_QUEUE) queue.removeFirst()
        }
        flushJob?.cancel()
        flushJob = scope.launch {
            delay(flushDelayMs)
            flush()
        }
    }

    suspend fun flush() = flushMutex.withLock {
        if (!enabled) return@withLock
        val batch = synchronized(queue) { queue.toList() }
        if (batch.isEmpty()) return@withLock
        val body = batchBody(apiKey, distinctId(), batch.map { it.event to it.at })
        val sent = withContext(Dispatchers.IO) { runCatching { sender.send("$host/batch/", body) }.getOrDefault(false) }
        if (sent) synchronized(queue) { repeat(batch.size) { queue.removeFirstOrNull() } }
    }

    companion object {
        const val EU_HOST = "https://eu.i.posthog.com"
        const val MAX_QUEUE = 200
        const val FLUSH_DELAY_MS = 2_000L
        const val PLATFORM = "android"

        /** The complete property set of an event. Adding a key here is a privacy decision. */
        fun properties(event: AnalyticsEvent): JsonObject = buildJsonObject {
            put("\$process_person_profile", false)
            put("\$geoip_disable", true)
            put("\$lib", "offgrid-android")
            put("platform", PLATFORM)
            if (event is AnalyticsEvent.ScreenViewed) put("screen", event.screen.pattern)
        }

        fun batchBody(apiKey: String, distinctId: String, events: List<Pair<AnalyticsEvent, Long>>): String = buildJsonObject {
            put("api_key", apiKey)
            putJsonArray("batch") {
                events.forEach { (event, at) ->
                    add(buildJsonObject {
                        put("event", event.name)
                        put("timestamp", Instant.ofEpochMilli(at).toString())
                        put("distinct_id", distinctId)
                        put("properties", properties(event))
                    })
                }
            }
        }.toString()
    }
}
