package ch.offgrid.android

import ch.offgrid.android.data.MessageEntity
import ch.offgrid.android.data.MessageStatus
import ch.offgrid.android.domain.Formats
import ch.offgrid.android.domain.Messaging
import ch.offgrid.android.domain.Settings
import ch.offgrid.android.link.LinkKind
import ch.offgrid.android.link.obj
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.LocalTime
import java.time.ZonedDateTime

/**
 * Demo content for the simulated antenna, matching the design screens (Anna, Luca, Mia, Jonas,
 * group "Gipfeltour"). Contacts are paired through the real link commands (`pair.begin`,
 * `pair.complete`, ping); only the chat history is written straight into the database because
 * history lives in the app anyway.
 */
class DemoData(private val app: AppContainer) {
    private val now get() = System.currentTimeMillis()

    suspend fun seedContacts(): Result<Unit> = runCatching {
        check(app.linkKind.value == LinkKind.SIMULATED) { "Demo-Daten nur mit simulierter Antenne" }
        app.antenna.state.first { it.ready }
        if (app.settings.get(Settings.DISPLAY_NAME) == null) app.settings.put(Settings.DISPLAY_NAME, "HolyG")
        val sim = app.simDevice
        val anna = pair(sim.addVirtualPeer("Anna Meier", -92, replies = listOf("Ja, ich warte hier. Es ist ziemlich windig.", "Alles klar, bis gleich!"),
            lat = 47.05812, lon = 8.31998))
        val luca = pair(sim.addVirtualPeer("Luca Bernasconi", -100, replies = listOf("Ja, bin in 30 Minuten dort.")))
        val mia = pair(sim.addVirtualPeer("Mia Frei", -110))
        pair(sim.addVirtualPeer("Jonas Keller", -100, scansBack = false))
        // Wait until the virtual peers answered the pairing ping.
        withTimeoutOrNull(8_000) {
            while (listOf(anna, luca, mia).any { app.db.contacts().byId(it)?.state != "active" }) delay(200)
        }
        // Let the pings' "delivered" events land first; they stamp "last seen" with the current time.
        withTimeoutOrNull(5_000) {
            while ((app.antenna.call("msg.pending")["pending"] as? JsonArray)?.isNotEmpty() == true) delay(200)
            delay(500)
        }
        app.db.contacts().byId(mia)?.let { sim.setPeerInRange(it.deviceContactId, false) }

        val min = 60_000L
        names(anna, "Anna", "Meier", rssi = -92, seen = now - 1 * min)
        names(luca, "Luca", "Bernasconi", rssi = -100, seen = now - 5 * min)
        val yesterday = ZonedDateTime.now(Formats.ZONE).minusDays(1).with(LocalTime.of(19, 12)).toInstant().toEpochMilli()
        names(mia, "Mia", "Frei", rssi = -110, seen = yesterday)

        val m = app.db.messages()
        m.insert(text(anna, "in", "Bin oben beim Gipfelkreuz. Hier gibt es keinen Handyempfang.", now - 12 * min, read = true))
        m.insert(text(anna, "out", "Wir sind bei der Hütte und kommen in etwa 20 Minuten.", now - 11 * min, status = MessageStatus.DELIVERED))
        m.insert(text(anna, "out", "Wartest du dort auf uns?", now - 9 * min, status = MessageStatus.SENT))
        m.insert(text(anna, "in", "Ja, ich warte hier. Es ist ziemlich windig.", now - 2 * min, read = false))
        m.insert(text(luca, "in", "Basislager erreicht.", now - 180 * min, read = true))
        m.insert(text(mia, "out", "Wir starten morgen um 7 Uhr.", yesterday, status = MessageStatus.DELIVERED))
    }

    suspend fun seedGroup(): Result<Long> = runCatching {
        val contacts = app.db.contacts().all().filter { it.state == "active" }
        val anna = contacts.first { it.displayName == "Anna Meier" }
        val luca = contacts.first { it.displayName == "Luca Bernasconi" }
        val id = app.messaging.createGroup("Gipfeltour", listOf(anna.id, luca.id)).getOrThrow()
        val min = 60_000L
        val m = app.db.messages()
        m.insert(MessageEntity(groupId = id, senderContactId = anna.id, senderName = anna.displayName, direction = "in", kind = "text",
            text = "Treffpunkt ist die Hütte, alle einverstanden?", status = MessageStatus.DELIVERED, sentAt = now - 3 * min, readAt = now))
        m.insert(MessageEntity(groupId = id, senderContactId = luca.id, senderName = luca.displayName, direction = "in", kind = "text",
            text = "Ja, bin in 30 Minuten dort.", status = MessageStatus.DELIVERED, sentAt = now - 1 * min, readAt = now))
        m.insert(MessageEntity(groupId = id, direction = "out", kind = "text", text = "Passt, bis gleich.",
            status = MessageStatus.SENT, sentAt = now))
        id
    }

    /** QR text of a new virtual peer, for testing the paste fallback of the scanner. */
    fun newPeerCode(name: String): String = app.simDevice.addVirtualPeer(name, -88, replies = listOf("Hallo! Schön, dass es klappt."),
        lat = 47.0561, lon = 8.3120)

    suspend fun setAllInRange(inRange: Boolean) {
        app.db.contacts().all().forEach { app.simDevice.setPeerInRange(it.deviceContactId, inRange) }
    }

    companion object {
        private val names = listOf("Lea Brunner", "Noah Steiner", "Elena Graf", "Timo Wyss", "Sara Huber")
        private var next = 0

        /** Names for virtual peers created from the scan tab or the demo menu. */
        fun nextPeerName(): String = names[next++ % names.size]
    }

    private suspend fun pair(qr: String): Long {
        app.antenna.call("pair.begin")
        val result = app.antenna.call("pair.complete", buildJsonObject { put("qr", qr) })
        val contact = result.obj("contact")!!
        val id = app.messaging.upsertFromDevice(app.antenna.state.value.deviceId!!, contact, keepName = false)
        val slot = app.db.contacts().byId(id)!!.deviceContactId
        app.antenna.call("msg.send", Messaging.pingArgs(slot))
        return id
    }

    private suspend fun names(id: Long, first: String, last: String, rssi: Int, seen: Long) {
        val c = app.db.contacts().byId(id) ?: return
        app.db.contacts().update(c.copy(firstName = first, lastName = last, lastRssi = rssi, lastSeenAt = seen))
    }

    private fun text(contactId: Long, dir: String, text: String, at: Long, status: Int = MessageStatus.DELIVERED, read: Boolean = true) =
        MessageEntity(contactId = contactId, direction = dir, kind = "text", text = text, status = status, sentAt = at,
            readAt = if (dir == "in" && read) at else null)
}
