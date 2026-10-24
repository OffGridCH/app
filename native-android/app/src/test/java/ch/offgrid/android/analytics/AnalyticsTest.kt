package ch.offgrid.android.analytics

import ch.offgrid.android.ui.Routes
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class AnalyticsTest {
    private val allEvents = listOf(
        AnalyticsEvent.AppOpened,
        AnalyticsEvent.ScreenViewed(Screen.CHAT),
        AnalyticsEvent.PairingStarted,
        AnalyticsEvent.PairingCompleted,
        AnalyticsEvent.MessageSent,
    )

    private class RecordingSender(var succeed: Boolean = true) : BatchSender {
        val calls = mutableListOf<Pair<String, String>>()
        override fun send(url: String, body: String): Boolean {
            calls += url to body
            return succeed
        }
    }

    @Test
    fun withoutKeyNothingIsQueuedOrSent() = runTest {
        val sender = RecordingSender()
        var idRequested = false
        val analytics = Analytics(apiKey = "", scope = backgroundScope, distinctId = { idRequested = true; "x" }, sender = sender)
        assertFalse(analytics.enabled)
        allEvents.forEach(analytics::track)
        testScheduler.advanceTimeBy(10_000)
        analytics.flush()
        assertEquals(emptyList<Pair<String, String>>(), sender.calls)
        assertFalse(idRequested)
    }

    @Test
    fun eventsCarryOnlyTheAllowedProperties() {
        val base = setOf("\$process_person_profile", "\$geoip_disable", "\$lib", "platform")
        allEvents.forEach { event ->
            val props = Analytics.properties(event)
            val expected = if (event is AnalyticsEvent.ScreenViewed) base + "screen" else base
            assertEquals(event.name, expected, props.keys)
            assertEquals("false", props.getValue("\$process_person_profile").jsonPrimitive.content)
            assertEquals("true", props.getValue("\$geoip_disable").jsonPrimitive.content)
            assertEquals("android", props.getValue("platform").jsonPrimitive.content)
        }
        val screen = Analytics.properties(AnalyticsEvent.ScreenViewed(Screen.CHAT)).getValue("screen").jsonPrimitive.content
        assertEquals("chat/:contactId", screen)
    }

    @Test
    fun batchGoesToTheEuHostWithOneRandomIdAndKeepsEventsOnFailure() = runTest {
        val sender = RecordingSender(succeed = false)
        val analytics = Analytics("phc_test", backgroundScope, distinctId = { "random-id" }, sender = sender)
        analytics.track(AnalyticsEvent.AppOpened)
        analytics.track(AnalyticsEvent.MessageSent)
        analytics.flush()
        sender.succeed = true
        analytics.flush()
        analytics.flush() // queue is empty now, nothing to send

        assertEquals(2, sender.calls.size)
        val (url, body) = sender.calls.last()
        assertEquals("https://eu.i.posthog.com/batch/", url)
        val json = Json.parseToJsonElement(body) as JsonObject
        assertEquals(setOf("api_key", "batch"), json.keys)
        val batch = json.getValue("batch") as JsonArray
        assertEquals(listOf("app_opened", "message_sent"), batch.map { (it as JsonObject).getValue("event").jsonPrimitive.content })
        batch.forEach {
            val e = it as JsonObject
            assertEquals(setOf("event", "timestamp", "distinct_id", "properties"), e.keys)
            assertEquals("random-id", e.getValue("distinct_id").jsonPrimitive.content)
        }
    }

    @Test
    fun everyRouteMapsToAPatternWithoutIds() {
        val routes = listOf(
            Routes.CONNECT, Routes.NAME, Routes.CONTACTS, Routes.ADD, Routes.ADDED, Routes.CHAT, Routes.LOCATION,
            Routes.SETTINGS, Routes.EXPORT, Routes.IMPORT, Routes.NEW_GROUP, Routes.GROUP,
        )
        routes.forEach { route ->
            val screen = Screen.fromRoute(route)
            assertNotNull(route, screen)
            assertFalse(screen!!.pattern.any(Char::isDigit))
        }
        assertEquals(Screen.ADD_CONTACT, Screen.fromRoute("kontakte/neu?tab={tab}"))
        assertNull(Screen.fromRoute("chat/42")) // filled-in paths never map
    }
}
