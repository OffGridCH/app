package ch.offgrid.android.data

import androidx.room.ColumnInfo
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

    /**
     * Gave up: "Nicht zugestellt" when the antenna had the message (reason from `msg.status`, or `lost`
     * when it vanished from the antenna's queue), "Nicht gesendet" when the antenna refused it (error code).
     */
    const val FAILED = 4

    /**
     * Lab image: no ACK after all retries, the antenna keeps it and sends it again when the contact is
     * heard, for up to 30 minutes ("Wartet auf …", `msg.status` state `waiting`).
     */
    const val WAITING = 5
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
    /**
     * Device handle from `msg.send`, unique only within one boot of the antenna. Set while the antenna
     * has the message and cleared when it reached a final state.
     */
    val msgRef: Int? = null,
    /**
     * `<device_id>/<random>` of the app's link session in which [msgRef] was last confirmed. `msg.status`
     * events only match messages of the current session; a reconnect re-confirms refs with `msg.pending`.
     */
    val refSession: String? = null,
    /** Counter of the message within the conversation direction, used to match reactions. */
    val ctr: Int? = null,
    /** Group messages: who wrote it. */
    val senderContactId: Long? = null,
    val senderName: String? = null,
    val rssi: Int? = null,
    /** SNR in dB of a received message (`msg.received.snr`). */
    val snr: Double? = null,
    /** Hops the ACK of a delivery reported, or the hops a received message took (0 = direct). */
    val hops: Int? = null,
    /** RETRY of the received copy, or the retries the antenna needed for an outgoing message. */
    val retry: Int? = null,
    /** Time from handing over to the authenticated ACK (`msg.status.rtt_ms`), waits and retries included. */
    val rttMs: Int? = null,
    /** Lab image: the TEXT body went on air OGZ1-compressed. Null when the firmware does not say. */
    val compressed: Boolean? = null,
    val bytesOnAir: Int? = null,
    val airtimeMs: Int? = null,
    /** Last state the antenna reported (`queued`, `sent`, `relayed`, `retrying`, `waiting`, …). */
    val deviceState: String? = null,
    /**
     * The delivery was not reported while the phone was connected; the reconciliation found it in
     * `msg.pending.recent` afterwards ("zugestellt, während offline").
     */
    @ColumnInfo(defaultValue = "0")
    val deliveredOffline: Boolean = false,
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
