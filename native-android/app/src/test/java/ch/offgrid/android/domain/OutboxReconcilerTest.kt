package ch.offgrid.android.domain

import ch.offgrid.android.data.MessageEntity
import ch.offgrid.android.data.MessageStatus
import ch.offgrid.android.link.Incoming
import ch.offgrid.android.link.LinkCodec
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OutboxReconcilerTest {
    private val device = "A4CF12F00D42"
    private val old = "$device/old-session"
    private val now = "$device/new-session"

    private fun out(id: Long, ref: Int?, status: Int = MessageStatus.SENT, session: String? = old, ctr: Int? = id.toInt(), group: Long? = null) =
        MessageEntity(id = id, contactId = if (group == null) 1 else null, groupId = group, direction = "out", kind = "text",
            text = "m$id", status = status, msgRef = ref, refSession = session, ctr = ctr, sentAt = id)

    private fun snapshot(pending: List<DeviceMessage> = emptyList(), recent: List<DeviceMessage> = emptyList()) = PendingSnapshot(pending, recent)

    private fun List<MessageEntity>.byId(id: Long) = single { it.id == id }

    @Test
    fun stillQueuedMessagesTakeTheDeviceStateAndMoveIntoTheNewSession() {
        val changed = OutboxReconciler.reconcile(
            listOf(out(1, 100, MessageStatus.DEVICE_QUEUED), out(2, 101, MessageStatus.WAITING)),
            device,
            snapshot(pending = listOf(DeviceMessage(100, "waiting", "no_ack"), DeviceMessage(101, "retrying"))),
            now,
        )
        with(changed.byId(1)) {
            assertEquals(MessageStatus.WAITING, status)
            assertEquals(100, msgRef)
            assertEquals(now, refSession)
        }
        // A queue state behind the local one does not move the message back, it only renews the session.
        with(changed.byId(2)) {
            assertEquals(MessageStatus.WAITING, status)
            assertEquals(now, refSession)
        }
    }

    @Test
    fun finalOutcomesFromRecentAreAppliedAndDropTheRef() {
        val changed = OutboxReconciler.reconcile(
            listOf(out(1, 100), out(2, 101, MessageStatus.WAITING), out(3, 102)),
            device,
            snapshot(recent = listOf(
                DeviceMessage(102, "cancelled"),
                DeviceMessage(101, "failed", "timeout"),
                DeviceMessage(100, "delivered"),
            )),
            now,
        )
        assertEquals(MessageStatus.DELIVERED, changed.byId(1).status)
        assertEquals(MessageStatus.FAILED, changed.byId(2).status)
        assertEquals("timeout", changed.byId(2).failReason)
        assertEquals("cancelled", changed.byId(3).failReason)
        assertTrue(changed.all { it.msgRef == null && it.refSession == null })
        // The delivery was only found afterwards: shown as "zugestellt, während offline", not as lost.
        assertTrue(changed.byId(1).deliveredOffline)
        assertTrue(changed.none { it.id != 1L && it.deliveredOffline })
    }

    @Test
    fun eventsCarryRetriesHopsAndTheTimeToTheAck() {
        val sent = out(1, 100, MessageStatus.SENT, session = now).copy(deviceState = "sent")
        val retrying = OutboxReconciler.applyEvent(sent, "retrying", null, DeliveryDetails(retry = 1))!!
        assertEquals(MessageStatus.SENT, retrying.status)
        assertEquals("retrying", retrying.deviceState)
        assertEquals(1, retrying.retry)
        val relayed = OutboxReconciler.applyEvent(retrying, "relayed", null)!!
        assertEquals(1, relayed.retry)
        val delivered = OutboxReconciler.applyEvent(relayed, "delivered", null, DeliveryDetails(retry = 2, hops = 1, rttMs = 1840))!!
        assertEquals(MessageStatus.DELIVERED, delivered.status)
        assertEquals(1, delivered.hops)
        assertEquals(1840, delivered.rttMs)
        assertEquals(2, delivered.retry)
        assertEquals(false, delivered.deliveredOffline)
        assertEquals(DeliveryDetails(2, 1, 1840), DeliveryDetails.parse(
            LinkCodec.json.parseToJsonElement("""{"msg_ref":100,"state":"delivered","retry":2,"hops":1,"rtt_ms":1840}""") as JsonObject,
        ))
    }

    @Test
    fun aMessageTheAntennaNoLongerKnowsIsLost() {
        val changed = OutboxReconciler.reconcile(listOf(out(1, 100, MessageStatus.WAITING)), device, PendingSnapshot.EMPTY, now)
        with(changed.single()) {
            assertEquals(MessageStatus.FAILED, status)
            assertEquals(OutboxReconciler.REASON_LOST, failReason)
            assertNull(msgRef)
            assertNull(refSession)
        }
    }

    @Test
    fun messagesOfAnotherAntennaAreLeftAlone() {
        val other = out(1, 100, session = "112233445566/s")
        assertTrue(OutboxReconciler.reconcile(listOf(other), device, PendingSnapshot.EMPTY, now).isEmpty())
    }

    @Test
    fun rowsWithoutSessionNeedTheSameCounterToStayOpen() {
        val changed = OutboxReconciler.reconcile(
            listOf(out(1, 7, session = null, ctr = 41), out(2, 8, session = null, ctr = 42), out(3, 9, session = null)),
            device,
            snapshot(
                pending = listOf(DeviceMessage(7, "sent", ctr = 41), DeviceMessage(8, "sent", ctr = 99)),
                recent = listOf(DeviceMessage(9, "delivered")),
            ),
            now,
        )
        assertEquals(now, changed.byId(1).refSession)
        assertEquals(7, changed.byId(1).msgRef)
        // Same ref but another counter: a message of a later boot, not this one.
        assertEquals(OutboxReconciler.REASON_LOST, changed.byId(2).failReason)
        // `recent` has no counter to prove it, so an old row is not marked delivered on a ref alone.
        assertEquals(OutboxReconciler.REASON_LOST, changed.byId(3).failReason)
    }

    @Test
    fun aRefFromAnEarlierBootCanNeverReachALaterMessage() {
        // Ref 5 was given out before the antenna restarted; after the restart the same number names a new message.
        val before = out(1, 5, MessageStatus.SENT, session = old)
        val settled = OutboxReconciler.reconcile(listOf(before), device, PendingSnapshot.EMPTY, now).single()
        assertNull(settled.msgRef)
        assertNull(settled.refSession)
        // Events match by (ref, current session), which this row no longer has; and a final row never changes.
        assertNull(OutboxReconciler.applyEvent(settled, "delivered", null))
        assertNull(OutboxReconciler.applyEvent(out(2, 6, MessageStatus.DELIVERED, session = now), "sent", null))
    }

    @Test
    fun eventsNeverMoveAMessageBackAndFinalsClearTheRef() {
        val waiting = out(1, 100, MessageStatus.WAITING, session = now).copy(deviceState = "waiting")
        assertNull(OutboxReconciler.applyEvent(waiting, "sent", null))
        assertNull(OutboxReconciler.applyEvent(waiting, "waiting", "no_ack"))
        assertNull(OutboxReconciler.applyEvent(waiting, "something_new", null))
        with(OutboxReconciler.applyEvent(waiting, "delivered", null)!!) {
            assertEquals(MessageStatus.DELIVERED, status)
            assertNull(msgRef)
            assertNull(refSession)
        }
        assertEquals("locked", OutboxReconciler.applyEvent(waiting, "failed", "locked")!!.failReason)
        assertEquals(MessageStatus.WAITING, OutboxReconciler.applyEvent(out(2, 101, session = now), "waiting", "no_ack")!!.status)
    }

    @Test
    fun sentIsFinalForGroupMessages() {
        val group = out(1, 100, MessageStatus.DEVICE_QUEUED, session = now, group = 3)
        with(OutboxReconciler.applyEvent(group, "sent", null)!!) {
            assertEquals(MessageStatus.SENT, status)
            assertNull(msgRef)
        }
    }

    @Test
    fun parsesThePendingResultOfTheLabImage() {
        val line = """{"id":3,"ok":true,"result":{"pending":[{"msg_ref":536870913,"to":2,"type":"text","ctr":12,"state":"waiting","retry":3}],""" +
            """"recent":[{"msg_ref":536870912,"state":"failed","reason":"timeout"},{"msg_ref":536870911,"state":"delivered"}]}}"""
        val result = (LinkCodec.decodeIncoming(line) as Incoming.Response).result
        val s = PendingSnapshot.parse(result)
        assertEquals(listOf(DeviceMessage(536870913, "waiting", null, 12, retry = 3)), s.pending)
        assertEquals(listOf(DeviceMessage(536870912, "failed", "timeout"), DeviceMessage(536870911, "delivered")), s.recent)
        // The team firmware has no `recent`.
        assertTrue(PendingSnapshot.parse(JsonObject(emptyMap())).recent.isEmpty())
    }
}
