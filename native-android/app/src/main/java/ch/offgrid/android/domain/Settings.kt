package ch.offgrid.android.domain

import ch.offgrid.android.data.SettingDao
import ch.offgrid.android.data.SettingEntity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import java.util.UUID

/** Key/value app settings stored in Room so they survive restarts and are easy to wipe. */
class Settings(private val dao: SettingDao, scope: CoroutineScope) {
    val values: StateFlow<Map<String, String>> = dao.observeAll()
        .map { list -> list.associate { it.key to it.value } }
        .stateIn(scope, SharingStarted.Eagerly, emptyMap())

    suspend fun get(key: String): String? = dao.get(key)
    suspend fun put(key: String, value: String) = dao.put(SettingEntity(key, value))
    suspend fun remove(key: String) = dao.remove(key)

    suspend fun bool(key: String, default: Boolean): Boolean = get(key)?.toBooleanStrictOrNull() ?: default

    /** Stable random ID of this installation; seeds the own "Muster" before the antenna is known. */
    suspend fun installId(): String = get(INSTALL_ID) ?: UUID.randomUUID().toString().also { put(INSTALL_ID, it) }

    companion object {
        const val ONBOARDED = "onboarded"
        const val DISPLAY_NAME = "display_name"
        const val INSTALL_ID = "install_id"
        const val BG_RECEIVE = "bg_receive"
        const val VIBRATE = "vibrate"
        const val LINK_KIND = "link_kind"
        const val OWN_PUBLIC_KEY = "own_public_key"

        /** Number of contacts the antenna lost (reset or reflash) that the contact list still has to point out. */
        const val REPAIR_NOTICE = "repair_notice"

        /** Unlock token restored from a backup, used once to take over the antenna, then rotated. */
        const val TRANSFER_TOKEN = "transfer_token"
        const val TRANSFER_DEVICE = "transfer_device"
    }
}
