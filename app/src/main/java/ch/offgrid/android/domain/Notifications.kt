package ch.offgrid.android.domain

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import ch.offgrid.android.MainActivity
import ch.offgrid.android.R
import ch.offgrid.android.data.MessageEntity
import ch.offgrid.android.data.OffGridDatabase
import kotlinx.coroutines.flow.first

/** A conversation as notifications and deep links see it. */
sealed interface Conversation {
    val notificationId: Int
    val uri: String

    data class Direct(val contactId: Long) : Conversation {
        override val notificationId get() = (CONTACT_BASE + contactId).toInt()
        override val uri get() = "offgrid://chat/$contactId"
    }

    data class Group(val groupId: Long) : Conversation {
        override val notificationId get() = (GROUP_BASE + groupId).toInt()
        override val uri get() = "offgrid://gruppe/$groupId"
    }

    companion object {
        // Id 1 is the background receive service; conversations stay clear of it.
        private const val CONTACT_BASE = 1_000_000L
        private const val GROUP_BASE = 2_000_000L

        fun of(m: MessageEntity): Conversation? = m.groupId?.let(::Group) ?: m.contactId?.let(::Direct)

        /** Parses the URIs above; anything else (other schemes, junk ids) is null. */
        fun parse(uri: String?): Conversation? {
            val match = uri?.let { Regex("^offgrid://(chat|gruppe)/(\\d{1,15})$").matchEntire(it) } ?: return null
            val id = match.groupValues[2].toLong()
            return if (match.groupValues[1] == "chat") Direct(id) else Group(id)
        }
    }
}

/** Title and text of a message notification, like the contact list preview. */
object NotificationText {
    fun title(contactName: String?, groupName: String?): String = groupName ?: contactName ?: "OffGrid"

    fun text(m: MessageEntity): String {
        val body = if (m.kind == "geo") "Standort" else m.text
        return if (m.groupId != null && m.senderName != null) "${m.senderName}: $body" else body
    }
}

/**
 * Posts one notification per conversation for incoming messages. The chat that is open on
 * screen gets none, and opening a chat clears its notification. Vibration stays with the app's
 * own setting, so the channel itself does not vibrate.
 */
class MessageNotifier(private val context: Context, private val db: OffGridDatabase) {
    /** The conversation whose screen is resumed right now, if any. */
    @Volatile
    var visible: Conversation? = null

    private val manager = NotificationManagerCompat.from(context)

    init {
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(CHANNEL, context.getString(R.string.messages_channel_name), NotificationManager.IMPORTANCE_HIGH).apply {
                enableVibration(false)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PRIVATE
            },
        )
    }

    fun canPost(): Boolean = manager.areNotificationsEnabled() &&
        (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)

    suspend fun onIncoming(m: MessageEntity) {
        val conversation = Conversation.of(m) ?: return
        if (conversation == visible || !canPost()) return
        val title = NotificationText.title(
            contactName = m.contactId?.let { db.contacts().byId(it)?.displayName },
            groupName = m.groupId?.let { db.groups().observe(it).first()?.name },
        )
        val open = PendingIntent.getActivity(
            context,
            conversation.notificationId,
            Intent(context, MainActivity::class.java).setAction(Intent.ACTION_VIEW).setData(Uri.parse(conversation.uri)),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(NotificationText.text(m))
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setColor(ACCENT)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            // The lock screen shows only this, never the sender or the text.
            .setPublicVersion(
                NotificationCompat.Builder(context, CHANNEL).setSmallIcon(R.drawable.ic_notification)
                    .setContentTitle(context.getString(R.string.messages_public_title)).build(),
            )
            .setWhen(m.sentAt)
            .setAutoCancel(true)
            .setContentIntent(open)
            .build()
        runCatching { manager.notify(conversation.notificationId, notification) }
    }

    fun cancel(conversation: Conversation) = manager.cancel(conversation.notificationId)

    private companion object {
        const val CHANNEL = "messages"

        /** `--og-accent`, tints the small icon. */
        const val ACCENT = 0xFF9DB4FF.toInt()
    }
}
