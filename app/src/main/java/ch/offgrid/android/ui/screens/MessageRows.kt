package ch.offgrid.android.ui.screens

import ch.offgrid.android.data.MessageEntity
import ch.offgrid.android.domain.Formats

/** One row of a message list: a day divider or a message with its layout flags. */
sealed interface MessageRow {
    val key: String

    data class Day(val label: String, override val key: String) : MessageRow

    /**
     * @property groupStart the direction changed against the previous message of the same day, so
     *   the bubble gets the 8 dp group gap.
     * @property continued an outgoing message right after another outgoing one; its bubble tucks the
     *   top corner in.
     * @property showSender group chats name the sender over the first of their consecutive messages.
     */
    data class Msg(
        val message: MessageEntity,
        val groupStart: Boolean,
        val continued: Boolean,
        val showSender: Boolean,
        override val key: String,
    ) : MessageRow
}

/** Rows oldest first: a day divider before the first message of each day, then the messages. */
fun messageRows(messages: List<MessageEntity>, now: Long): List<MessageRow> = buildList {
    messages.forEachIndexed { i, m ->
        val before = messages.getOrNull(i - 1)
        val newDay = before == null || !Formats.sameDay(before.sentAt, m.sentAt)
        if (newDay) add(MessageRow.Day(Formats.day(m.sentAt, now), "day-${m.id}"))
        val previous = before.takeUnless { newDay }
        add(
            MessageRow.Msg(
                message = m,
                groupStart = previous != null && previous.direction != m.direction,
                continued = m.direction == "out" && previous?.direction == "out",
                showSender = m.direction == "in" &&
                    (previous == null || previous.direction != "in" || previous.senderContactId != m.senderContactId),
                key = "msg-${m.id}",
            ),
        )
    }
}
