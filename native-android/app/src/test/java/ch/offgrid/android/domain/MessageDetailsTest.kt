package ch.offgrid.android.domain

import ch.offgrid.android.data.MessageEntity
import ch.offgrid.android.data.MessageStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MessageDetailsTest {
    private fun out(status: Int) = MessageEntity(contactId = 1, direction = "out", kind = "text", text = "Hallo", status = status, sentAt = 0)

    @Test
    fun aDeliveredMessageShowsHopsRetriesAndTheTimeToTheAck() {
        val m = out(MessageStatus.DELIVERED).copy(hops = 0, retry = 1, rttMs = 1840, ctr = 42, compressed = false, bytesOnAir = 30)
        val rows = MessageDetails.rows(m, "Anna").toMap()
        assertEquals("Zugestellt", rows["Status"])
        assertEquals("Direkt", rows["Hops"])
        assertEquals("1", rows["Wiederholungen"])
        assertEquals("1.8 s", rows["Zeit bis Bestätigung"])
        assertEquals("42", rows["Zähler"])
        assertEquals("Nein", rows["Komprimiert (OGZ1)"])
    }

    @Test
    fun aDeliveryFoundAfterReconnectSaysSo() {
        assertEquals("Zugestellt, während offline", MessageDetails.status(out(MessageStatus.DELIVERED).copy(deliveredOffline = true)))
        assertEquals("Wartet auf Anna", MessageDetails.status(out(MessageStatus.WAITING), "Anna"))
        assertEquals("Gesendet, wird wiederholt", MessageDetails.status(out(MessageStatus.SENT).copy(deviceState = "retrying")))
    }

    @Test
    fun aReceivedMessageShowsTheSignalOfItsCopy() {
        val m = MessageEntity(contactId = 1, direction = "in", kind = "text", text = "Hoi", status = MessageStatus.DELIVERED, sentAt = 0,
            rssi = -91, snr = 6.25, hops = 2, retry = 1, compressed = true, ctr = 7)
        val rows = MessageDetails.rows(m).toMap()
        assertEquals("-91 dBm", rows["RSSI"])
        assertEquals("6.3 dB", rows["SNR"])
        assertEquals("2 Weiterleitungen", rows["Hops"])
        assertEquals("Wiederholung 1", rows["Empfangene Sendung"])
        assertEquals("Ja", rows["Komprimiert (OGZ1)"])
        assertTrue(MessageDetails.hasRadioDetails(m))
    }

    @Test
    fun valuesTheFirmwareDidNotReportAreLeftOut() {
        val m = out(MessageStatus.FAILED).copy(failReason = OutboxReconciler.REASON_LOST)
        val rows = MessageDetails.rows(m).toMap()
        assertEquals(setOf("Status", "Grund"), rows.keys)
        assertEquals("Nicht zugestellt", rows["Status"])
        assertFalse(MessageDetails.hasRadioDetails(m))
        assertEquals("Nicht gesendet", MessageDetails.status(out(MessageStatus.FAILED).copy(failReason = "E_TOO_LONG")))
    }
}
