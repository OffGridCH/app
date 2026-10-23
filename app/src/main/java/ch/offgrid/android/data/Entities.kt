package ch.offgrid.android.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

/**
 * A contact as the app sees it. The keys for this contact live on the Heltec (link spec 1.1); the
 * app only keeps the slot number on that device plus display data and history.
 */
@Serializable
@Entity(tableName = "contacts", indices = [Index(value = ["publicKey"], unique = true)])
data class ContactEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    /** Base-MAC device ID of the Heltec that holds the keys. */
    val deviceId: String,
    /** `contact_id` slot (1 to 32) on that Heltec. */
    val deviceContactId: Int,
    val displayName: String,
    val firstName: String? = null,
    val lastName: String? = null,
    val nodeId: String,
    val publicKey: String,
    val fingerprint: String,
    /** `pending` until the first valid packet from the peer verified, then `active`. */
    val state: String,
    val lastRssi: Int? = null,
    val lastSnr: Double? = null,
    val lastSeenAt: Long? = null,
    val createdAt: Long,
)

/** Local delivery state. Values are stored as integers, so never reorder them. */
object MessageStatus {
    /** Created while the antenna was not ready; handed to the device later ("in Warteschlange"). */
    const val LOCAL_QUEUED = 0

    /** Accepted by the device, waiting for channel access ("wartet auf Funk …"). */
    const val DEVICE_QUEUED = 1

    /** Transmitted, relayed or retrying ("gesendet"). */
    const val SENT = 2

    /** End-to-end ACK verified ("zugestellt"). */
    const val DELIVERED = 3

    /** Gave up ("Nicht gesendet"). */
    const val FAILED = 4
}

@Serializable
@Entity(
    tableName = "messages",
    indices = [Index("contactId"), Index("groupId"), Index("msgRef")],
)
data class MessageEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val contactId: Long? = null,
    val groupId: Long? = null,
    /** `in` or `out`. */
    val direction: String,
    /** `text` or `geo`. */
    val kind: String,
    val text: String = "",
    val lat: Double? = null,
    val lon: Double? = null,
    /** Only known for our own fixes; protocol v1 does not transmit accuracy. */
    val accuracyM: Int? = null,
    val ageS: Int? = null,
    val status: Int,
    val failReason: String? = null,
    /** Device handle from `msg.send`, unique since the device booted. Cleared on `sys.boot`. */
    val msgRef: Int? = null,
    /** Counter of the message within the conversation direction, used to match reactions. */
    val ctr: Int? = null,
    /** Group messages: who wrote it. */
    val senderContactId: Long? = null,
    val senderName: String? = null,
    val rssi: Int? = null,
    /**
     * Reaction shown under this message: on our own messages the peer's, on the peer's messages
     * the one we sent. The column name predates the second case; renaming it would need a migration.
     */
    val peerReaction: String? = null,
    val sentAt: Long,
    val readAt: Long? = null,
)

/**
 * A group chat. Groups are a proposed link extension (`group.*`, see README), because protocol and
 * link v1 put group chats out of scope.
 */
@Serializable
@Entity(tableName = "groups")
data class GroupEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val deviceId: String,
    val deviceGroupId: Int,
    val name: String,
    val createdAt: Long,
)

@Serializable
@Entity(tableName = "group_members", primaryKeys = ["groupId", "contactId"])
data class GroupMemberEntity(val groupId: Long, val contactId: Long)

@Entity(tableName = "settings")
data class SettingEntity(@PrimaryKey val key: String, val value: String)
