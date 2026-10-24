package ch.offgrid.android.domain

import ch.offgrid.android.data.MessageEntity
import ch.offgrid.android.data.MessageStatus
import ch.offgrid.android.link.int
import ch.offgrid.android.link.str
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import java.util.UUID

/** One `msg.pending` item or `recent` entry. */
data class DeviceMessage(val ref: Int, val state: String, val reason: String? = null, val ctr: Int? = null)

/**
 * A `msg.pending` result: what the antenna still has in its queue and, on the lab image, the last 16
 * messages that reached a final state since it booted (`recent`, newest first).
 */
data class PendingSnapshot(val pending: List<DeviceMessage>, val recent: List<DeviceMessage>) {
    companion object {
        val EMPTY = PendingSnapshot(emptyList(), emptyList())

        fun parse(result: JsonObject): PendingSnapshot {
            fun list(key: String) = (result[key] as? JsonArray).orEmpty().mapNotNull { item ->
                val o = item as? JsonObject ?: return@mapNotNull null
                DeviceMessage(o.int("msg_ref") ?: return@mapNotNull null, o.str("state") ?: return@mapNotNull null, o.str("reason"), o.int("ctr"))
            }
            return PendingSnapshot(list("pending"), list("recent"))
        }
    }
}

/**
 * Keeps the local delivery state of outgoing messages in step with the antenna (lab contract item 5).
 *
 * A `msg_ref` means something only on one antenna and within one boot of it, and `msg.status` events
 * are lost while the phone is not connected. So every message the antenna accepted carries the link
 * session it was confirmed in ([MessageEntity.refSession]); events only update messages of the current
 * session, and on every (re)connect [reconcile] settles the messages of earlier sessions against
 * `msg.pending`:
 *
 * - still in the queue: take over its state (never backwards) and move it into the new session;
 * - in `recent`: apply the final state the event would have brought;
 * - neither: the antenna lost it (restart, older image without `recent`, or more than 16 outcomes
 *   since), so it fails with reason [REASON_LOST] and the user can send it again. The app never resends
 *   on its own: the receiver could already have it, and a resend gets a new counter.
 *
 * A message that reaches a final state drops its ref and session, so an old ref can never touch it again.
 */
object OutboxReconciler {
    /** The antenna no longer knows the message; shown as "Nicht zugestellt". */
    const val REASON_LOST = "lost"

    fun newSession(deviceId: String): String = "$deviceId/${UUID.randomUUID()}"

    private fun deviceOf(session: String): String = session.substringBefore('/')

    /** Local status for a `msg.status` / `msg.pending` state, null for states this app does not know. */
    fun statusFor(state: String): Int? = when (state) {
        "queued" -> MessageStatus.DEVICE_QUEUED
        "sent", "relayed", "retrying" -> MessageStatus.SENT
        "waiting" -> MessageStatus.WAITING
        "delivered" -> MessageStatus.DELIVERED
        "failed", "cancelled" -> MessageStatus.FAILED
        else -> null
    }

    /** Order of the open states; a late event must not move a message back (waiting, then a stale "sent"). */
    private fun rank(status: Int): Int = when (status) {
        MessageStatus.DEVICE_QUEUED -> 1
        MessageStatus.SENT -> 2
        MessageStatus.WAITING -> 3
        else -> 0
    }

    /**
     * Applies a device state from a `msg.status` event to [m]. Returns the new row, or null when nothing
     * changes. Group messages have no end-to-end ACK, so "sent" is final for them.
     */
    fun applyEvent(m: MessageEntity, state: String, reason: String?): MessageEntity? {
        if (rank(m.status) == 0) return null // already final, or not yet with the antenna
        val status = statusFor(state) ?: return null
        val final = status == MessageStatus.DELIVERED || status == MessageStatus.FAILED ||
            (m.groupId != null && status == MessageStatus.SENT)
        if (final) return finished(m, status, state, reason)
        if (rank(status) <= rank(m.status)) return null
        return m.copy(status = status, failReason = null)
    }

    private fun finished(m: MessageEntity, status: Int, state: String, reason: String?): MessageEntity = m.copy(
        status = status,
        failReason = if (status == MessageStatus.FAILED) (if (state == "cancelled") "cancelled" else reason ?: "failed") else null,
        msgRef = null,
        refSession = null,
    )

    /**
     * Settles the [open] messages (accepted by an antenna, no final state) against [snapshot], the
     * `msg.pending` answer of antenna [deviceId] at the start of link session [session]. Messages of other
     * antennas stay as they are. Returns only the rows that changed.
     *
     * Rows from before refs had a session (database version 1) cannot prove which boot their ref belongs
     * to; they only stay open when a queue item has the same ref and the same counter.
     */
    fun reconcile(open: List<MessageEntity>, deviceId: String, snapshot: PendingSnapshot, session: String): List<MessageEntity> {
        val pending = snapshot.pending.associateBy { it.ref }
        val recent = snapshot.recent.associateBy { it.ref }
        return open.mapNotNull { m ->
            val ref = m.msgRef ?: return@mapNotNull null
            val legacy = m.refSession == null
            if (!legacy && deviceOf(m.refSession!!) != deviceId) return@mapNotNull null
            val queued = pending[ref]?.takeIf { !legacy || (it.ctr != null && it.ctr == m.ctr) }
            val done = recent[ref]?.takeIf { !legacy }
            val updated = when {
                queued != null -> {
                    val next = applyEvent(m, queued.state, queued.reason) ?: m
                    if (next.msgRef == null) next else next.copy(refSession = session)
                }
                done != null -> statusFor(done.state)?.let { finished(m, it, done.state, done.reason) } ?: lost(m)
                else -> lost(m)
            }
            updated.takeIf { it != m }
        }
    }

    fun lost(m: MessageEntity): MessageEntity =
        m.copy(status = MessageStatus.FAILED, failReason = REASON_LOST, msgRef = null, refSession = null)
}
