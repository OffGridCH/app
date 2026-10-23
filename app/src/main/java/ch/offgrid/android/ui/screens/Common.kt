package ch.offgrid.android.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ch.offgrid.android.domain.AntennaError
import ch.offgrid.android.domain.Conversation
import ch.offgrid.android.domain.KeyPattern
import ch.offgrid.android.domain.LocationError
import ch.offgrid.android.domain.PairingError
import ch.offgrid.android.ui.LocalApp
import ch.offgrid.android.ui.theme.Og
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/** Page frame: graphite background, safe-area padding, keyboard aware. */
@Composable
fun Page(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier.fillMaxSize().background(Og.bg).windowInsetsPadding(WindowInsets.safeDrawing).imePadding(),
        content = content,
    )
}

/** Current time that ticks every 30 s, so "zuletzt …" and signal staleness stay current. */
@Composable
fun rememberNow(): Long {
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(30_000)
            now = System.currentTimeMillis()
        }
    }
    return now
}

fun patternFor(fingerprint: String): BooleanArray = KeyPattern.fromSeed(KeyPattern.contactSeed(fingerprint))

/** Texts from the screen spec table "Fehlertexte". */
fun AntennaError.text(): String = when (this) {
    AntennaError.NO_DEVICE -> "Keine Antenne gefunden. Prüfe das USB-C-Kabel."
    AntennaError.PERMISSION_DENIED -> "Zugriff auf die Antenne wurde nicht erlaubt."
    AntennaError.OPEN_FAILED -> "Die Antenne liess sich nicht öffnen. Steck sie neu ein."
    AntennaError.NO_INFO -> "Die Antenne antwortet nicht."
    AntennaError.PROTO_MISMATCH -> "Die Firmware der Antenne passt nicht zu dieser App-Version."
    AntennaError.LOST -> "Verbindung zur Antenne verloren."
    AntennaError.UNLOCK_FAILED -> "Diese Antenne ist mit einem anderen Handy verbunden. Übertrage sie mit „Daten exportieren“ vom alten Handy."
}

fun PairingError.text(): String = when (this) {
    PairingError.INVALID_QR -> "Das ist kein OffGrid-Code."
    PairingError.ANTENNA_NOT_READY -> "Antenne nicht verbunden. Der Schlüssel wird gesendet, sobald sie verbunden ist."
    PairingError.CONTACT_EXISTS -> "Dieser Kontakt ist schon gespeichert."
    PairingError.SELF_PAIR -> "Das ist dein eigener Code."
    PairingError.FAILED -> "Der Schlüsselaustausch hat nicht geklappt. Versucht es erneut."
}

fun LocationError.text(): String = when (this) {
    LocationError.DENIED -> "Standortzugriff fehlt. Erlaube ihn in den Android-Einstellungen."
    LocationError.TIMEOUT -> "Kein GPS-Signal. Geh ins Freie und versuch es erneut."
    LocationError.UNAVAILABLE -> "Der Standort ist gerade nicht verfügbar."
    LocationError.NO_MAPS_APP -> "Keine Karten-App gefunden. Die Koordinaten sind kopiert."
}

/**
 * Marks [conversation] as on screen while this screen is resumed: its notifications are cleared
 * and new ones are not posted.
 */
@Composable
fun ConversationOnScreen(conversation: Conversation) {
    val notifier = LocalApp.current.notifier
    LifecycleResumeEffect(conversation) {
        notifier.visible = conversation
        notifier.cancel(conversation)
        onPauseOrDispose { if (notifier.visible == conversation) notifier.visible = null }
    }
}

/** A database row as a screen sees it: still loading, or loaded (null when the row is gone). */
sealed interface Loaded<out T> {
    data object Pending : Loaded<Nothing>

    data class Done<T>(val value: T) : Loaded<T>
}

/** Collects a single-row flow so a screen can tell "not loaded yet" from "deleted". */
@Composable
fun <T> Flow<T>.collectLoaded(): State<Loaded<T>> =
    remember(this) { map<T, Loaded<T>> { Loaded.Done(it) } }.collectAsStateWithLifecycle(Loaded.Pending)
