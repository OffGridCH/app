package ch.offgrid.android.domain

import ch.offgrid.android.data.MessageEntity
import ch.offgrid.android.data.MessageStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test

class NotificationsTest {
    private fun incoming(contactId: Long? = 3, groupId: Long? = null, kind: String = "text", text: String = "Hallo", sender: String? = null) =
        MessageEntity(
            contactId = contactId, groupId = groupId, direction = "in", kind = kind, text = text,
            status = MessageStatus.DELIVERED, sentAt = 0, senderName = sender,
        )

    @Test
    fun conversationUrisRoundTrip() {
        listOf(Conversation.Direct(7), Conversation.Group(42)).forEach { assertEquals(it, Conversation.parse(it.uri)) }
    }

    @Test
    fun foreignOrBrokenUrisAreIgnored() {
        listOf(null, "", "https://example.com/chat/1", "offgrid://chat/", "offgrid://chat/abc", "offgrid://chat/1/../2", "offgrid://kontakte/1")
            .forEach { assertNull(it, Conversation.parse(it)) }
    }

    @Test
    fun contactsAndGroupsGetSeparateNotificationIds() {
        assertNotEquals(Conversation.Direct(5).notificationId, Conversation.Group(5).notificationId)
        assertNotEquals(1, Conversation.Direct(0).notificationId) // id 1 belongs to the background service
    }

    @Test
    fun groupMessagesBelongToTheGroup() {
        assertEquals(Conversation.Group(9), Conversation.of(incoming(contactId = null, groupId = 9)))
        assertEquals(Conversation.Direct(3), Conversation.of(incoming()))
    }

    @Test
    fun textLikeTheContactListPreview() {
        assertEquals("Hallo", NotificationText.text(incoming()))
        assertEquals("Standort", NotificationText.text(incoming(kind = "geo", text = "")))
        assertEquals("Lea: Hallo", NotificationText.text(incoming(contactId = null, groupId = 9, sender = "Lea")))
    }

    @Test
    fun titlePrefersTheGroupName() {
        assertEquals("Wandergruppe", NotificationText.title("Lea Brunner", "Wandergruppe"))
        assertEquals("Lea Brunner", NotificationText.title("Lea Brunner", null))
        assertEquals("OffGrid", NotificationText.title(null, null))
    }
}
