package ch.offgrid.android.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ch.offgrid.android.domain.AntennaState
import ch.offgrid.android.domain.Pairing
import ch.offgrid.android.domain.PairingError
import ch.offgrid.android.domain.PairingState
import ch.offgrid.android.ui.components.Step
import ch.offgrid.android.ui.components.StepState
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * Owns the pairing session of "Kontakt hinzufügen". It lives as long as the screen's back stack
 * entry, so rotating the phone keeps the QR code and the scan progress; only leaving the screen
 * cancels. After process death a new instance starts a fresh pairing.
 */
class AddContactViewModel(
    private val pairing: Pairing,
    private val antenna: StateFlow<AntennaState>,
) : ViewModel() {
    private var finished = false

    /** A valid code scanned while the antenna was away; `pair.complete` runs once it is back. */
    private var waitingCode: String? = null

    val ui: StateFlow<AddContactUi> = combine(pairing.state, antenna) { p, a -> addContactUi(p, a.ready) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, addContactUi(pairing.state.value, antenna.value.ready))

    init {
        pairing.begin()
        viewModelScope.launch {
            // Only transitions back to ready; the first value is the state when the screen opened.
            antenna.map { it.ready }.distinctUntilChanged().drop(1).filter { it }.collectLatest { onReconnected() }
        }
    }

    fun scan(code: String) {
        // Pairing drops a code it cannot send yet, but the error text promises "Der Schlüssel wird
        // gesendet, sobald sie verbunden ist", so the screen keeps it until the antenna is back.
        waitingCode = code.takeIf { !antenna.value.ready && Pairing.looksLikeOffGridQr(it.trim()) }
        pairing.complete(code)
    }

    fun clearError() = pairing.clearError()

    /** "Neu koppeln" after `E_CONTACT_EXISTS`: replaces the keys of that contact; the peer has to do the same. */
    fun replace() {
        val code = pairing.state.value.replaceCode ?: return
        pairing.complete(code, replace = true)
    }

    /** The contact is confirmed: end the session before the screen navigates on. */
    fun finish() {
        if (finished) return
        finished = true
        pairing.finish()
    }

    private suspend fun onReconnected() {
        if (finished) return
        val before = pairing.state.value
        val code = waitingCode
        // Unplugging the antenna restarts it and loses the pending salt behind the shown code; Pairing then
        // fetches a fresh one (it keeps the code when the antenna stayed unlocked). After our own scan the
        // contact is stored with that salt and the code must stay the same until the other side has scanned it.
        val freshCode = before.scannedName == null
        if (freshCode && before.qr != null) pairing.begin()
        if (code == null) return
        // `pair.complete` must run against the pairing that belongs to the code on screen.
        if (freshCode) pairing.state.first { it.qr != null && it.codeVersion > before.codeVersion }
        waitingCode = null
        pairing.complete(code)
    }

    override fun onCleared() {
        if (!finished) pairing.leave()
    }
}

/** What "Kontakt hinzufügen" shows for a pairing state and the antenna connection. */
data class AddContactUi(
    /** QR text to render; null while it loads or while the antenna is away and the code may be stale. */
    val qr: String?,
    val error: PairingError?,
    /** The code changed after it may have been scanned; the other side has to scan it again. */
    val codeRenewed: Boolean = false,
    /** "Neu koppeln" is offered for a contact the antenna already has. */
    val canReplace: Boolean = false,
    val scannedName: String?,
    val pingSent: Boolean,
    val confirmedContactId: Long?,
) {
    val confirmed: Boolean get() = confirmedContactId != null
}

fun addContactUi(pairing: PairingState, antennaReady: Boolean): AddContactUi {
    val scanned = pairing.scannedName != null
    return AddContactUi(
        // After our own scan the code stays valid without the antenna (see AddContactViewModel).
        qr = pairing.qr.takeIf { antennaReady || scanned },
        // Pairing only notices a lost antenna at its next refresh, so the screen reports it at once.
        error = pairing.error ?: PairingError.ANTENNA_NOT_READY.takeIf { !antennaReady },
        codeRenewed = pairing.codeRenewed,
        canReplace = pairing.replaceCode != null && antennaReady,
        scannedName = pairing.scannedName,
        pingSent = pairing.pingSent,
        confirmedContactId = pairing.confirmedContactId,
    )
}

/** Steps of the tab "Mein Code" (`Handshake.dc.html`). */
fun myCodeSteps(codeReady: Boolean, confirmed: Boolean): List<Step> = listOf(
    Step("Code bereit", if (codeReady) StepState.Done else StepState.Active, meta = if (codeReady) "erledigt" else null),
    Step(
        "Gegenüber scannt",
        when {
            confirmed -> StepState.Done
            codeReady -> StepState.Active
            else -> StepState.Todo
        },
        meta = when {
            confirmed -> "erledigt"
            codeReady -> "wartet …"
            else -> null
        },
    ),
    Step("Antwort per Funk empfangen", if (confirmed) StepState.Done else StepState.Todo),
)

/** Steps of the tab "Code scannen" after a successful scan. */
fun scanSteps(pingSent: Boolean, confirmed: Boolean): List<Step> {
    // The peer's own packet confirms the contact even when our ping was refused by the firmware.
    val sent = pingSent || confirmed
    return listOf(
        Step("Code gescannt", StepState.Done, meta = "erledigt"),
        Step("Schlüssel per Funk gesendet", if (sent) StepState.Done else StepState.Active, meta = if (sent) "erledigt" else "sendet …"),
        Step(
            "Bestätigung empfangen",
            when {
                confirmed -> StepState.Done
                sent -> StepState.Active
                else -> StepState.Todo
            },
            meta = if (sent && !confirmed) "wartet …" else null,
        ),
    )
}
