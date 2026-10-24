package ch.offgrid.android.ui.screens

import ch.offgrid.android.data.MessageEntity
import ch.offgrid.android.data.MessageStatus
import java.time.LocalDateTime
import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Test

class MessageRowsTest {
    private val zone = ZoneId.of("Europe/Zurich")
    private fun at(day: Int, hour: Int) = LocalDateTime.of(2026, 10, day, hour, 0).atZone(zone).toInstant().toEpochMilli()
    private val now = at(24, 12)

    private fun msg(id: Long, direction: String, sentAt: Long, sender: Long? = null, status: Int = MessageStatus.DELIVERED) = MessageEntity(
        id = id, contactId = 1, direction = direction, kind = "text", text = "m$id",
        status = status, sentAt = sentAt, senderContactId = sender,
    )

    private fun List<MessageRow>.msgs() = filterIsInstance<MessageRow.Msg>().associateBy { it.message.id }

    @Test
    fun dayDividerBeforeFirstMessageOfEachDay() {
        val rows = messageRows(listOf(msg(1, "in", at(23, 9)), msg(2, "in", at(23, 10)), msg(3, "out", at(24, 8))), now)
        assertEquals(listOf("day-1", "msg-1", "msg-2", "day-3", "msg-3"), rows.map { it.key })
        assertEquals("GESTERN", (rows[0] as MessageRow.Day).label)
        assertEquals("HEUTE", (rows[3] as MessageRow.Day).label)
    }

    @Test
    fun groupStartOnlyWhereTheDirectionChangesWithinADay() {
        val rows = messageRows(
            listOf(msg(1, "in", at(24, 8)), msg(2, "in", at(24, 9)), msg(3, "out", at(24, 10)), msg(4, "in", at(24, 11))),
            now,
        ).msgs()
        assertEquals(listOf(false, false, true, true), (1L..4L).map { rows.getValue(it).groupStart })
    }

    @Test
    fun noGroupGapRightAfterADayDivider() {
        val rows = messageRows(listOf(msg(1, "in", at(23, 9)), msg(2, "out", at(24, 9))), now).msgs()
        assertEquals(false, rows.getValue(2).groupStart)
        assertEquals(false, rows.getValue(2).continued)
    }

    @Test
    fun continuedMarksConsecutiveOutgoingBubbles() {
        val rows = messageRows(
            listOf(msg(1, "out", at(24, 8)), msg(2, "out", at(24, 9)), msg(3, "in", at(24, 10)), msg(4, "out", at(24, 11))),
            now,
        ).msgs()
        assertEquals(listOf(false, true, false, false), (1L..4L).map { rows.getValue(it).continued })
    }

    @Test
    fun senderNameOverTheFirstOfConsecutiveMessagesBySameSender() {
        val rows = messageRows(
            listOf(
                msg(1, "in", at(24, 8), sender = 7), msg(2, "in", at(24, 9), sender = 7),
                msg(3, "in", at(24, 10), sender = 8), msg(4, "out", at(24, 11)), msg(5, "in", at(24, 11), sender = 8),
            ),
            now,
        ).msgs()
        assertEquals(listOf(true, false, true, false, true), (1L..5L).map { rows.getValue(it).showSender })
    }

    @Test
    fun noTuckedCornerAfterAFailedBubble() {
        val rows = messageRows(listOf(msg(1, "out", at(24, 8), status = MessageStatus.FAILED), msg(2, "out", at(24, 9))), now).msgs()
        assertEquals(false, rows.getValue(2).continued)
    }
}
